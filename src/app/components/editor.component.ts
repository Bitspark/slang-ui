import {Component, HostListener, OnInit, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Composable, Connection, OperatorDef, OperatorInstance, Port, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {
  createDefaultValue, deepEquals,
  generateSvgTransform, HTTP_REQUEST_DEF, HTTP_RESPONSE_DEF,
  normalizeConnections,
  stringifyConnections,
  SVGConnectionLineGenerator
} from '../utils';
import {ApiService} from '../services/api.service';
import {VisualService} from '../services/visual.service';
import 'codemirror/mode/yaml/yaml.js';
import {TypeDefFormComponent} from './type-def-form.component';
import {HttpClient} from '@angular/common/http';
import {MouseService} from '../services/mouse.service';

@Component({
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  animations: [
    trigger('operatorSaved', [
      state('true', style({
        opacity: 1
      })),
      state('false', style({
        opacity: 0
      })),
      transition('false => true', animate('250ms ease-in')),
      transition('true => false', animate('1000ms 1000ms ease-out'))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorComponent implements OnInit {
  // General
  public operatorName = '';
  public operatorDef: OperatorDef = null;
  public operator: OperatorInstance = null;
  public mainSrvPort: any = null;
  public propertyDefs: any = null;
  public status;
  public newPropName = '';
  public newInstanceName = '';
  public userMessage = '';
  public userMessageTimeout: any = null;

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
  public hoveredEntity: { entity: Port | Connection } = {entity: null as any};
  public selectedEntity = {entity: null as any};
  public scale = 0.6;
  public isOperatorSaved = false;
  public canvasFocus = false;

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
  private mouseAction(event, phase) {
    const update = phase === 'ongoing';

    if (!update) {
      return;
    }

    const xDiff = event.screenX - this.mouse.getLastX();
    const yDiff = event.screenY - this.mouse.getLastY();

    if (this.mouse.isDragging()) {
      const selectedInstance = this.visual.getSelectedInstance();
      if (!selectedInstance) {
        return;
      }
      selectedInstance.translate([xDiff / this.scale, yDiff / this.scale]);
      this.visual.update(selectedInstance);
    } else if (this.mouse.isResizing()) {
      if (!this.operator) {
        return;
      }
      this.operator.resize([xDiff / this.scale, yDiff / this.scale]);
      this.refresh();
      this.visual.update(this.operator);
    }
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.canvasFocus) {
      return;
    }
    switch (event.key) {
      case '+':
        this.scale *= 1.1;
        break;
      case '-':
        this.scale /= 1.1;
        break;
      case 'Delete':
      case 'Backspace':
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
              public visual: VisualService,
              public api: ApiService,
              private cd: ChangeDetectorRef,
              public mouse: MouseService) {
    cd.detach();
    visual.subscribeInstanceSelect(ins => {
      this.selectInstance(ins);
    });
    visual.subscribePortSelect(port => {
      this.selectPort(port);
    });
    mouse.subscribe((event: any, actionPhase: string) => this.mouseAction(event, actionPhase));
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
    await this.visual.storeVisual(this.operatorName, this.operator.getVisual());
    this.isOperatorSaved = true;
    await this.operators.refresh();
    await this.loadOperator(this.operatorName);
    this.isOperatorSaved = false;
  }

  public download() {
    const url = this.api.downloadUrl(this.operator.getFullyQualifiedName());
    window.location.href = url;
  }

  public async loadOperator(operatorName) {
    this.operatorName = operatorName;
    this.operatorDef = this.operators.getLocal(this.operatorName);
    if (this.operatorDef) {
      const def = this.operatorDef.getDef();
      const visual = await this.visual.loadVisual(operatorName);
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
      this.cd.detectChanges();
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

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public translate(comp: Composable): string {
    return `translate(${comp.getAbsX()},${comp.getAbsY()})`;
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

  public connectionPoints(conn: Connection, outer: OperatorInstance): string {
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

  public hover(e: Port | Connection | null) {
    this.hoveredEntity.entity = e;
  }

  public isAnyEntityHovered(): boolean {
    return this.hoveredEntity.entity !== null;
  }

  public isHovered(e: Port | Connection): boolean {
    return this.hoveredEntity.entity === e;
  }

  public isConnectionHovered(): boolean {
    return this.isAnyEntityHovered() && this.hoveredEntity.entity instanceof Connection;
  }

  public selectInstance(ins: OperatorInstance) {
    this.mouse.setDragging();
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

  public isConnectionSelected(): boolean {
    return this.isAnyEntitySelected() && this.selectedEntity.entity instanceof Connection;
  }

  public isPortRelatedToConnection(c: Connection, p: Port): boolean {
    const srcPorts = c.getSource().getPrimitivePorts();
    if (srcPorts.filter(_p => _p === p).length) {
      return true;
    }
    const dstPorts = c.getDestination().getPrimitivePorts();
    if (dstPorts.filter(_p => _p === p).length) {
      return true;
    }
    return false;
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

  public getSelectedInstanceLastName(): string {
    if (this.isInstanceSelected()) {
      return (this.selectedEntity.entity as OperatorInstance).lastName();
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

  public displayUserMessage(msg: string) {
    this.userMessage = msg;
    if (this.userMessageTimeout != null) {
      clearTimeout(this.userMessageTimeout);
    }
    const that = this;
    this.userMessageTimeout = setTimeout(function () {
      that.userMessage = '';
    }, 5000);
  }

  public selectPort(port1: Port) {
    if (port1.isUnspecifiedGeneric()) {
      this.displayUserMessage(`Cannot select unspecified generic port. Specify generic type '${port1.getGeneric()}'.`);
      return;
    }

    if (this.selectedEntity.entity && this.selectedEntity.entity instanceof Port) {
      const port2 = this.selectedEntity.entity as Port;

      if (port1.isGeneric() && !port2.isGeneric() && !port2.isTrigger()) {
        this.displayUserMessage(`Cannot connect generic port with non-generic port. Specify generic type '${port1.getGeneric()}'.`);
        return;
      }
      if (port2.isGeneric() && !port1.isGeneric() && !port1.isTrigger()) {
        this.displayUserMessage(`Cannot connect generic port with non-generic port. Specify generic type '${port2.getGeneric()}'.`);
        return;
      }
      if (port1.isGeneric() && port2.isGeneric() && port1.getGeneric() !== port2.getGeneric()) {
        this.displayUserMessage(`Cannot connect generic ports with differing names: ` +
          `'${port1.getGeneric()}' is not the same as '${port2.getGeneric()}'.`);
        return;
      }

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

  // Executing

  public debugLog(msg: string) {
    this.debuggingLog.push(msg);
  }

  public async startDebugging() {
    await this.save();
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

    const isStream = !this.httpInput() && !this.httpOutput();

    this.http.post('http://localhost:5149/run/', {
      fqn: this.operatorName,
      gens: this.debuggingGens,
      props: this.debuggingProps,
      stream: isStream
    }).toPromise()
      .then(data => {
        if (data['status'] === 'success') {
          this.operatorEndpoint = data['url'];
          this.debugLog('Operator is running at ' + this.operatorEndpoint);
          this.running = true;
          this.runningHandle = data['handle'];

          if (isStream) {
            let interval = null;
            const that = this;
            const fetchItems = function () {
              that.http.get(that.operatorEndpoint).toPromise()
                .then(responses => {
                  that.debuggingReponses = responses as Array<any>;
                })
                .catch(() => {
                  clearInterval(interval);
                });
            };
            fetchItems();
            interval = setInterval(fetchItems, 2000);
          }
        } else {
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
      });
  }

  public httpInput(): boolean {
    return deepEquals(this.operatorDef.getDef().services.main.in, HTTP_REQUEST_DEF);
  }

  public httpOutput(): boolean {
    return deepEquals(this.operatorDef.getDef().services.main.out, HTTP_RESPONSE_DEF);
  }

  public async sendInputValue(obj: any) {
    await this.http.post(this.operatorEndpoint, JSON.stringify(obj)).toPromise();
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

  public clearOutput() {
    this.debuggingReponses = [];
  }

}