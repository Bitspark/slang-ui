import {Component, HostListener, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Composable, Connection, OperatorDef, OperatorInstance, Port, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {
  createDefaultValue, deepEquals,
  generateSvgTransform, HTTP_REQUEST_DEF, HTTP_RESPONSE_DEF,
  normalizeConnections,
  stringifyConnections
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
export class EditorComponent implements OnInit, OnDestroy {
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

  private mouseCallback: (event: string, actionPhase: string) => void;

  // Dragging
  private mouseAction(event, phase) {
    const update = phase === 'ongoing';

    if (!update) {
      return;
    }

    const xDiff = event.screenX - this.mouse.getLastX();
    const yDiff = event.screenY - this.mouse.getLastY();

    if (this.mouse.isDragging()) {
      const selectedInstance = this.visual.getSelected();
      if (!selectedInstance || !(selectedInstance instanceof OperatorInstance)) {
        return;
      }
      selectedInstance.translate([xDiff / this.scale, yDiff / this.scale]);
      this.updateInstance(selectedInstance);
    } else if (this.mouse.isResizing()) {
      if (!this.operator) {
        return;
      }
      this.operator.resize([xDiff / this.scale, yDiff / this.scale]);
      this.refresh();
    }
  }

  @HostListener('window:keydown', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.canvasFocus) {
      return;
    }
    switch (event.key) {
      case '+':
        this.scale *= 1.1;
        this.ref.detectChanges();
        break;
      case '-':
        this.scale /= 1.1;
        this.ref.detectChanges();
        break;
      case 'Delete':
      case 'Backspace':
        const selectedEntity = this.visual.getSelected();
        if (!selectedEntity) {
          return;
        }
        if (selectedEntity instanceof OperatorInstance) {
          this.removeInstance(selectedEntity);
          this.visual.select(null);
          this.visual.update(this.operator);
          break;
        }
        if (selectedEntity instanceof Connection) {
          this.removeConnection(selectedEntity);
          this.visual.select(null);
          this.visual.update(this.operator);
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
              private ref: ChangeDetectorRef,
              public mouse: MouseService) {
    ref.detach();
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
    this.visual.subscribeSelect(obj => {
      if (obj instanceof OperatorInstance) {
        this.selectInstance(obj);
      } else if (obj instanceof Port) {
        this.selectPort(obj);
      }
    });
    this.mouseCallback = this.mouse.subscribe((event: any, actionPhase: string) => this.mouseAction(event, actionPhase));
  }

  ngOnDestroy() {
    this.mouse.unsubscribe(this.mouseCallback);
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
      this.ref.detectChanges();
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

  private updateInstance(ins: OperatorInstance) {
    this.visual.update(ins);
    // Also update connections
    this.operator.getConnections().forEach(conn => {
      if (conn.getSource().getOperator() === ins || conn.getDestination().getOperator() === ins) {
        this.visual.update(conn);
      }
    });
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
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.rotate(Math.PI / 2);
      this.updateInstance(ins);
    }
  }

  public rotateLeft() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.rotate(-Math.PI / 2);
      this.updateInstance(ins);
    }
  }

  public mirrorVertically() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.scale([1, -1]);
      this.updateInstance(ins);
    }
  }

  public mirrorHorizontally() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.scale([-1, 1]);
      this.updateInstance(ins);
    }
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
    return !!this.visual.getSelected();
  }

  public isSelected(entity: any): boolean {
    return this.isAnyEntitySelected() && this.visual.getSelected() === entity;
  }

  public isInstanceSelected(): boolean {
    return this.isAnyEntitySelected() && this.visual.getSelected() !== this.operator &&
      this.visual.getSelected() instanceof OperatorInstance;
  }

  public isConnectionSelected(): boolean {
    return this.isAnyEntitySelected() && this.visual.getSelected() instanceof Connection;
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

  public getSelectedInstance(): OperatorInstance {
    const selected = this.visual.getSelected();
    if (!(selected instanceof OperatorInstance)) {
      return null;
    }
    return selected;
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
    this.visual.update(this.operator);
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
    this.ref.detectChanges();
  }

  public specifyProperty(props, name, def) {
    props[name] = createDefaultValue(def);
  }

  public setUIMode(mode: string): string {
    this.uiMode = mode.toLowerCase();
    this.ref.detectChanges();
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
    this.ref.detectChanges();
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
    this.ref.detectChanges();

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
              that.ref.detectChanges();
            };
            fetchItems();
            interval = setInterval(fetchItems, 2000);
          }
        } else {
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
        this.ref.detectChanges();
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
        this.ref.detectChanges();
      });
  }

  public closeDebugPanel() {
    this.debugState = null;
    this.ref.detectChanges();
  }

}
