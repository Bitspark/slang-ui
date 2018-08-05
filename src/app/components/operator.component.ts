import {Component, HostListener, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Composable, Connection, OperatorDef, OperatorInstance, Port, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {
  createDefaultValue,
  generateSvgTransform,
  normalizeConnections,
  stringifyConnections,
  SVGConnectionLineGenerator
} from '../utils';
import {ApiService} from '../services/api.service';
import {VisualService} from '../services/visual.service';
import 'codemirror/mode/yaml/yaml.js';
import {TypeDefFormComponent} from './type-def-form.component';
import {Orientation} from '../classes/vector';
import {HttpClient} from '@angular/common/http';

class MouseMoueTracker {
  private static lastX: number;
  private static lastY: number;

  private moving: boolean;
  private actionType = '';

  constructor(private mouseAction: (t: MouseMoueTracker, event: any, actionPhase: string) => void) {
  }

  public static getLastX(): number {
    return this.lastX;
  }

  public static getLastY(): number {
    return this.lastY;
  }

  public setResizing() {
    this.actionType = 'resize';
  }

  public setDragging() {
    this.actionType = 'drag';
  }

  public isResizing() {
    return this.actionType === 'resize';
  }

  public isDragging() {
    return this.actionType === 'drag';
  }

  public start(event: any) {
    this.moving = true;
    this.mouseAction(this, event, 'start');
    MouseMoueTracker.lastX = event.screenX;
    MouseMoueTracker.lastY = event.screenY;
  }

  public stop(event: any) {
    this.moving = false;
    this.mouseAction(this, event, 'stop');
    MouseMoueTracker.lastX = event.screenX;
    MouseMoueTracker.lastY = event.screenY;
    this.actionType = '';
  }

  public track(event: any) {
    if (event.buttons === 0) {
      this.moving = false;
    }
    if (this.moving) {
      this.mouseAction(this, event, 'ongoing');
      MouseMoueTracker.lastX = event.screenX;
      MouseMoueTracker.lastY = event.screenY;
    }
  }
}

@Component({
  templateUrl: './operator.component.html',
  styleUrls: ['./operator.component.scss']
})
export class OperatorComponent implements OnInit {
  // General
  public operatorName = '';
  public operatorDef: OperatorDef = null;
  public operator: OperatorInstance = null;
  public mainSrvPort: any = null;
  public propertyDefs: any = null;
  public status;
  public newPropName = '';
  public newInstanceName = '';

  // YAML
  public yamlRepr = '';
  public uiMode = 'visual';
  public editorConfig = {
    theme: 'slang-dark',
    mode: 'text/x-yaml',
    lineNumbers: true,
    extraKeys: {
      Tab: function (cm) {
        const spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
        cm.replaceSelection(spaces);
      }
    }
  };

  // Visual
  public selectedEntity = {entity: null as any};
  public scale = 0.6;
  public filterString = '';

  private insPropDefs = new Map<string, Array<{ name: string, def: any }>>();

  // Executing
  public inputValue: any = {};
  public debugState = null;
  public running = false;
  public runningHandle = '';
  public debuggingLog: Array<string> = [];
  public debuggingReponses: Array<any> = [];
  public debuggingGens = {};
  public debuggingPropDefs = {};
  public debuggingInPort = {};
  public debuggingOutPort = {};
  public debuggingProps = {};
  public operatorEndpoint = '';

  // Dragging
  public mouseTracker = new MouseMoveTracker((t, event, phase) => {
    const update = phase === 'ongoing';

    if (!update) {
      return;
    }

    const xDiff = event.screenX - MouseMoveTracker.getLastX();
    const yDiff = event.screenY - MouseMoveTracker.getLastY();

    if (t.isDragging()) {
      if (!this.selectedEntity.entity || typeof this.selectedEntity.entity.translate !== 'function') {
        return;
      }
      this.selectedEntity.entity.translate([xDiff / this.scale, yDiff / this.scale]);
    } else if (t.isResizing()) {
      if (!this.operator) {
        return;
      }
      this.operator.resize([xDiff / this.scale, yDiff / this.scale]);
      this.refresh();
    }
  });

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    switch (event.key) {
      case '+':
        this.scale *= 1.1;
        break;
      case '-':
        this.scale /= 1.1;
        break;
      case 'Delete':
        if (!this.selectedEntity.entity) {
          return;
        }
        if (this.selectedEntity.entity instanceof OperatorInstance) {
          this.removeInstance(this.selectedEntity.entity);
          this.selectedEntity.entity = null;
          break;
        }
        if (this.selectedEntity.entity instanceof Connection) {
          this.removeConnection(this.selectedEntity.entity);
          this.selectedEntity.entity = null;
          break;
        }
        break;
    }
  }

  constructor(private route: ActivatedRoute,
              private http: HttpClient,
              public operators: OperatorService,
              public visuals: VisualService,
              public api: ApiService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.loadOperator(routeParams.operatorName);
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.loadOperator(this.operatorName);
      }
    });
  }

  // General

  public async save() {
    await this.operators.storeDefinition(this.operatorName, this.operatorDef.getDef());
    await this.visuals.storeVisual(this.operatorName, this.operator.getVisual());
    await this.operators.refresh();
    await this.loadOperator(this.operatorName);
  }

  public async loadOperator(operatorName) {
    this.operatorName = operatorName;
    this.operatorDef = this.operators.getLocal(this.operatorName);
    if (this.operatorDef) {
      const def = this.operatorDef.getDef();
      const visual = await this.visuals.loadVisual(operatorName);
      let dim: [number, number] = [1200, 1100];
      let pos: [number, number] = [50, 50];
      if (visual && visual.geometry) {
        if (typeof visual.geometry.width !== 'undefined' && typeof visual.geometry.height !== 'undefined') {
          dim = [visual.geometry.width, visual.geometry.height];
        }
        if (typeof visual.geometry.x !== 'undefined' && typeof visual.geometry.y !== 'undefined') {
          pos = [visual.geometry.x, visual.geometry.y];
        }
      }
      /*
       * We compare selectedEntity by identity, so after re-initializing all operators, that comparsion fails
       */
      const newOperator = new OperatorInstance(this.operators, this.operatorName, '', this.operatorDef, {}, null, def, dim);
      if (this.isSelected(this.operator)) {
        this.selectedEntity.entity = newOperator;
      }
      this.operator = newOperator;
      this.operator.translate(pos);
      this.updateDef(def);
      if (visual) {
        this.operator.updateVisual(visual);
      }
    } else {
      this.status = `Operator "${this.operatorName}" not found.`;
    }
  }

  public removeInstance(ins: OperatorInstance) {
    if (ins === this.operator) {
      return;
    }
    const def = this.operatorDef.getDef();
    for (const src in def['connections']) {
      if (def['connections'].hasOwnProperty(src)) {
        if (this.operator.getPort(src).getOperator() === ins) {
          delete def['connections'][src];
          continue;
        }
        def['connections'][src] = def['connections'][src].filter(dst => this.operator.getPort(dst).getOperator() !== ins);
        if (def['connections'][src].length === 0) {
          delete def['connections'][src];
        }
      }
    }
    delete def['operators'][ins.getName()];
    this.updateDef(def);
  }

  public removeConnection(conn: Connection) {
    const conns = this.operator.getConnections();
    conns.delete(conn);
    const def = this.operatorDef.getDef();
    const connsCpy = new Set<Connection>(conns);
    normalizeConnections(connsCpy);
    def['connections'] = stringifyConnections(connsCpy);
    this.updateDef(def);
  }

  public addConnection(src: Port, dst: Port) {
    const conns = this.operator.getConnections();
    conns.forEach(conn => {
      if (conn.getDestination() === dst) {
        conns.delete(conn);
      }
    });
    conns.add(new Connection(src, dst));
    const def = this.operatorDef.getDef();
    const connsCpy = new Set<Connection>(conns);
    normalizeConnections(connsCpy);
    def['connections'] = stringifyConnections(connsCpy);
    this.updateDef(def);
  }

  public stringify(val: any): string {
    return JSON.stringify(val, undefined, 2);
  }

  // YAML
  public refresh(noPropDefs?: boolean) {
    if (!noPropDefs) {
      this.insPropDefs = new Map<string, Array<{ name: string, def: any }>>();
    }
    this.displayYaml();
    this.displayVisual();
  }

  public updateYaml(newYaml) {
    this.yamlRepr = newYaml;
  }

  public storeYaml() {
    try {
      const newDef = safeLoad(this.yamlRepr);
      this.updateDef(newDef);
    } catch (e) {
      this.status = e.toString();
    }
  }

  private updateDef(def: any) {
    this.operatorDef.setDef(def);
    const opDef = this.operatorDef.getDef();
    this.mainSrvPort = opDef.services.main;
    if (!opDef.properties) {
      opDef.properties = {};
    }
    this.propertyDefs = opDef.properties;
    this.status = `Updated definition of operator "${this.operatorName}".`;
    this.refresh();
  }

  public getPropertyNames(): Array<string> {
    const names = [];
    for (const propName in this.propertyDefs) {
      if (this.propertyDefs.hasOwnProperty(propName)) {
        names.push(propName);
      }
    }
    return names;
  }

  private displayYaml() {
    this.yamlRepr = safeDump(this.operatorDef.getDef());
  }

  // Visual

  public transformLabel(port: Port): string {
    return `rotate(-55 ${this.getPortLabelX(port)},${this.getPortLabelY(port)})`;
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public translate(comp: Composable): string {
    return `translate(${comp.getAbsX()},${comp.getAbsY()})`;
  }

  public translatePort(port: Port): string {
    return `translate(${port.getCenterX()},${port.getCenterY()})`;
  }

  public rotateRight() {
    if (this.isInstanceSelected()) {
      this.selectedEntity.entity.rotate(Math.PI / 2);
    }
  }

  public rotateLeft() {
    if (this.isInstanceSelected()) {
      this.selectedEntity.entity.rotate(-Math.PI / 2);
    }
  }

  public mirrorVertically() {
    if (this.isInstanceSelected()) {
      this.selectedEntity.entity.scale([1, -1]);
    }
  }

  public mirrorHorizontally() {
    if (this.isInstanceSelected()) {
      this.selectedEntity.entity.scale([-1, 1]);
    }
  }

  public connectionPoints(conn: Connection): string {
    return SVGConnectionLineGenerator.generateRoundPath(this.operator, conn);
  }

  public visualInstances(): Array<OperatorInstance> {
    if (!this.operator) {
      return [];
    }
    return Array.from(this.operator.getInstances().values()).filter(ins => ins.isVisible());
  }

  public visualConnections(): Array<Connection> {
    if (!this.operator) {
      return [];
    }
    return Array.from(this.operator.getConnections().values());
  }

  public selectInstance(ins: OperatorInstance) {
    this.mouseTracker.setDragging();
    this.selectedEntity.entity = ins;
    this.newInstanceName = ins.getName();
  }

  public selectConnection(conn: Connection) {
    this.selectedEntity.entity = conn;
  }

  public isAnyEntitySelected(): boolean {
    return this.selectedEntity.entity !== null;
  }

  public isSelected(entity: any): boolean {
    return this.isAnyEntitySelected() && this.selectedEntity.entity === entity;
  }

  public isInstanceSelected(): boolean {
    return this.isAnyEntitySelected() && this.selectedEntity.entity !== this.operator &&
      this.selectedEntity.entity instanceof OperatorInstance;
  }

  public getSelectedInstanceName(): string {
    if (this.isInstanceSelected()) {
      return (this.selectedEntity.entity as OperatorInstance).getName();
    }
    return '';
  }

  public getSelectedInstanceFQName(): string {
    if (this.isInstanceSelected()) {
      return (this.selectedEntity.entity as OperatorInstance).getFullyQualifiedName();
    }
    return '';
  }

  public renameInstance(ins: OperatorInstance, newName: string) {
    this.operator.renameInstance(ins.getName(), newName);
    this.refresh();
  }

  public genericNames(ins: OperatorInstance): Array<string> {
    return Array.from(ins.getGenericNames());
  }

  public selectPort(port1: Port) {
    if (this.selectedEntity.entity && this.selectedEntity.entity instanceof Port) {
      const port2 = this.selectedEntity.entity as Port;
      if (port1.getOperator() === this.operator) {
        if (port2.getOperator() === this.operator) {
          if (port1.isIn() && port2.isOut()) {
            this.addConnection(port1, port2);
          } else if (port2.isIn() && port1.isOut()) {
            this.addConnection(port2, port1);
          }
        } else {
          if (port1.isIn() && port2.isIn()) {
            this.addConnection(port1, port2);
          } else if (port2.isOut() && port1.isOut()) {
            this.addConnection(port2, port1);
          }
        }
      } else {
        if (port2.getOperator() === this.operator) {
          if (port2.isIn() && port1.isIn()) {
            this.addConnection(port2, port1);
          } else if (port1.isOut() && port2.isOut()) {
            this.addConnection(port1, port2);
          }
        } else {
          if (port1.isOut() && port2.isIn()) {
            this.addConnection(port1, port2);
          } else if (port2.isOut() && port1.isIn()) {
            this.addConnection(port2, port1);
          } else {
            this.selectedEntity.entity = port1;
            return;
          }
        }
      }
      this.selectedEntity.entity = null;
    } else {
      this.selectedEntity.entity = port1;
    }
  }

  private displayVisual() {
    const def = this.operatorDef.getDef();
    this.operator.updateOperator(def, undefined);
  }

  public addInstance(op: any) {
    const def = this.operatorDef.getDef();
    const opSplit = op.name.split('.');
    const opName = opSplit[opSplit.length - 1];
    let insName = opName;
    let i = 1;
    if (!def.operators) {
      def.operators = {};
    }
    while (def.operators[insName]) {
      insName = opName + i;
      i++;
    }
    def.operators[insName] = {
      operator: op.name
    };
    this.updateDef(def);
  }

  public addPropertyDef(propName: string) {
    if (this.propertyDefs[propName]) {
      return;
    }
    this.propertyDefs[propName] = TypeDefFormComponent.newDefaultTypeDef('primitive');
    this.refresh();
  }

  public removePropertyDef(propName: string) {
    delete this.propertyDefs[propName];
    this.refresh();
  }

  public getPorts(): Array<Port> {
    if (this.operator) {
      return this.operator.getPrimitivePorts();
    } else {
      return [];
    }
  }

  public getPortLabelX(port: Port): number {
    switch (port.getOrientation().value()) {
      case Orientation.north:
        return 0;
      case Orientation.west:
        return 15;
      case Orientation.south:
        return 0;
      case Orientation.east:
        return -15;
    }
  }

  public getPortLabelY(port: Port): number {
    switch (port.getOrientation().value()) {
      case Orientation.north:
        return 15;
      case Orientation.west:
        return 0;
      case Orientation.south:
        return -15;
      case Orientation.east:
        return 0;
    }
  }

  public getPortLabelAnchor(port: Port): string {
    switch (port.getOrientation().value()) {
      case Orientation.north:
        return 'end';
      case Orientation.west:
        return 'begin';
      case Orientation.south:
        return 'begin';
      case Orientation.east:
        return 'end';
    }
  }

  public getOperatorList(): Array<OperatorDef> {
    return []
      .concat(
        Array.from(this.operators.getLocals().values()).filter(op => !this.operator || op !== this.operator.opDef),
        Array.from(this.operators.getLibraries().values()),
        Array.from(this.operators.getElementaries().values()));
  }

  public isGenericSpecified(ins: OperatorInstance, genName: string): boolean {
    const generics = this.getGenerics(ins);
    return generics && generics[genName];
  }

  public getGenerics(ins: OperatorInstance): any {
    const oDef = this.operatorDef.getDef();
    return oDef.operators[ins.getName()].generics;
  }

  public addGeneric(ins: OperatorInstance, genName: string) {
    const oDef = this.operatorDef.getDef();
    const insOpDef = oDef.operators[ins.getName()];
    if (!insOpDef.generics) {
      insOpDef.generics = {};
    }
    insOpDef.generics[genName] = TypeDefFormComponent.newDefaultTypeDef('primitive');
  }

  public specifyGeneric(gens, name) {
    gens[name] = TypeDefFormComponent.newDefaultTypeDef('primitive');
  }

  public isPropertySpecified(ins: OperatorInstance, prop: { name: string, def: any }): boolean {
    const props = this.getProperties(ins);
    return props && typeof props[prop.name] !== 'undefined';
  }

  public getPropertyDefs(ins: OperatorInstance): Array<{ name: string, def: any }> {
    const def = this.insPropDefs.get(ins.getName());
    if (def) {
      return def;
    }

    const generics = this.getGenerics(ins);
    const arr = Array.from(ins.getPropertyDefs().entries()).map(each => {
      const defCopy = JSON.parse(JSON.stringify(each[1]));
      OperatorDef.specifyTypeDef(defCopy, generics, {}, {});
      return {name: each[0], def: defCopy};
    });
    this.insPropDefs.set(ins.getName(), arr);
    return arr;
  }

  public getProperties(ins: OperatorInstance): any {
    const oDef = this.operatorDef.getDef();
    return oDef.operators[ins.getName()].properties;
  }

  public addProperty(ins: OperatorInstance, prop: { name: string, def: any }): any {
    const oDef = this.operatorDef.getDef();
    const insOpDef = oDef.operators[ins.getName()];
    if (!insOpDef.properties) {
      insOpDef.properties = {};
    }
    insOpDef.properties[prop.name] = createDefaultValue(prop.def);
  }

  public specifyProperty(props, name, def) {
    props[name] = createDefaultValue(def);
  }

  public setUIMode(mode: string): string {
    this.uiMode = mode.toLowerCase();
    return this.uiMode;
  }

  public isUIModeVisual(): boolean {
    return this.uiMode === 'visual';
  }

  public isUIModeYAML(): boolean {
    return this.uiMode === 'yaml';
  }


  public text(ins: OperatorInstance): string {
    const fqn = ins.getFullyQualifiedName();
    const props = ins.getProperties();

    if (fqn === 'slang.const') {
      return !!props ? JSON.stringify(props['value']) : 'const?';
    } else if (fqn === 'slang.eval') {
      return !!props ? props['expression'] : 'eval?';
    } else {
      const opName = ins.getFullyQualifiedName().split('.');
      return opName[opName.length - 1];
    }
  }

  public fqn(ins: OperatorInstance): string {
    const fqn = ins.getFullyQualifiedName().split('.');
    return fqn[fqn.length - 1];
  }

  // Executing

  public debugLog(msg: string) {
    this.debuggingLog.push(msg);
  }

  public startDebugging() {
    this.save();
    this.refreshDebugVariables();
    if (this.operator.getGenericNames().size > 0 || this.operator.getPropertyDefs().size > 0) {
      this.specifyOperator();
    } else {
      this.runOperator();
    }
  }

  public specifyOperator() {
    this.debugState = 'specifying';
  }

  public refreshDebugVariables() {
    this.debuggingPropDefs = JSON.parse(JSON.stringify(this.propertyDefs));
    for (const propName in this.debuggingPropDefs) {
      if (this.debuggingPropDefs.hasOwnProperty(propName)) {
        OperatorDef.specifyTypeDef(this.debuggingPropDefs[propName], this.debuggingGens, {}, {});
        this.debuggingProps[propName] = createDefaultValue(this.debuggingPropDefs[propName]);
      }
    }

    this.debuggingInPort = JSON.parse(JSON.stringify(this.mainSrvPort.in));
    OperatorDef.specifyTypeDef(this.debuggingInPort, this.debuggingGens, {}, {});

    this.debuggingOutPort = JSON.parse(JSON.stringify(this.mainSrvPort.out));
    OperatorDef.specifyTypeDef(this.debuggingOutPort, this.debuggingGens, {}, {});
  }

  public runOperator() {
    this.debugState = 'debugging';
    this.inputValue = createDefaultValue(this.debuggingInPort);

    this.debugLog('Request daemon to start operator...');

    this.http.post('http://localhost:5149/run/', {
      fqn: this.operatorName,
      gens: this.debuggingGens,
      props: this.debuggingProps
    }).toPromise()
      .then(data => {
        if (data['status'] === 'success') {
          this.operatorEndpoint = data['url'];
          this.debugLog('Operator is running at ' + this.operatorEndpoint);
          this.running = true;
          this.runningHandle = data['handle'];
        } else {
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
      });
  }

  public sendInputValue(obj: any) {
    this.http.post(this.operatorEndpoint, JSON.stringify(obj)).toPromise()
      .then(data => {
        this.debuggingReponses.push(data);
      });
  }

  public stopOperator() {
    this.http.request('delete', 'http://localhost:5149/run/', {
      body: {
        handle: this.runningHandle
      }
    }).toPromise()
      .then(data => {
        if (data['status'] === 'success') {
          this.running = false;
          this.runningHandle = '';
        } else {
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
      });
  }

  public closeDebugPanel() {
    this.debugState = null;
  }

}

class MouseMoveTracker {
  private static lastX: number;
  private static lastY: number;

  private moving: boolean;
  private actionType = '';

  constructor(private mouseAction: (t: MouseMoveTracker, event: any, actionPhase: string) => void) {
  }

  public static getLastX(): number {
    return this.lastX;
  }

  public static getLastY(): number {
    return this.lastY;
  }

  public setResizing() {
    this.actionType = 'resize';
  }

  public setDragging() {
    this.actionType = 'drag';
  }

  public isResizing() {
    return this.actionType === 'resize';
  }

  public isDragging() {
    return this.actionType === 'drag';
  }

  public start(event: any) {
    this.moving = true;
    this.mouseAction(this, event, 'start');
    MouseMoveTracker.lastX = event.screenX;
    MouseMoveTracker.lastY = event.screenY;
  }

  public stop(event: any) {
    this.moving = false;
    this.mouseAction(this, event, 'stop');
    MouseMoveTracker.lastX = event.screenX;
    MouseMoveTracker.lastY = event.screenY;
    this.actionType = '';
  }

  public track(event: any) {
    if (event.buttons === 0) {
      this.moving = false;
    }
    if (this.moving) {
      this.mouseAction(this, event, 'ongoing');
      MouseMoveTracker.lastX = event.screenX;
      MouseMoveTracker.lastY = event.screenY;
    }
  }
}
