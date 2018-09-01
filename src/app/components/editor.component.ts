import {Component, HostListener, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {animate, state, style, transition, trigger} from '@angular/animations';

import {ApiService} from '../services/api.service';
import {BroadcastService} from '../services/broadcast.service';
import {MouseService} from '../services/mouse.service';
import {OperatorService} from '../services/operator.service';
import {VisualService} from '../services/visual.service';

import {TypeDefFormComponent} from './type-def-form.component';

import {Connection, OperatorDef, OperatorInstance, Port} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {createDefaultValue, normalizeConnections, stringifyConnections, deepEquals, HTTP_REQUEST_DEF, HTTP_RESPONSE_DEF} from '../utils';

import 'codemirror/mode/yaml/yaml.js';

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
  private callback: (Identifiable) => void;

  // Dragging
  private mouseAction(event, phase) {
    const update = phase === 'ongoing';

    if (!update) {
      return;
    }

    const xDiff = event.screenX - this.mouse.getLastX();
    const yDiff = event.screenY - this.mouse.getLastY();

    if (this.mouse.isDragging()) {
      const selectedInstance = this.broadcast.getSelected();
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
        const selectedEntity = this.broadcast.getSelected();
        if (!selectedEntity) {
          return;
        }
        if (selectedEntity instanceof OperatorInstance) {
          this.removeInstance(selectedEntity);
          this.broadcast.select(null);
          this.broadcast.update(this.operator);
          break;
        }
        if (selectedEntity instanceof Connection) {
          this.removeConnection(selectedEntity);
          this.broadcast.select(null);
          this.broadcast.update(this.operator);
          break;
        }
        break;
    }
  }

  constructor(private route: ActivatedRoute,
              private http: HttpClient,
              public operators: OperatorService,
              public visual: VisualService,
              public broadcast: BroadcastService,
              public api: ApiService,
              private ref: ChangeDetectorRef,
              public mouse: MouseService) {
    ref.detach();
  }

  ngOnInit() {
    this.broadcast.clear();
    this.route.params.subscribe(routeParams => {
      this.loadOperator(routeParams.operatorName);
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.loadOperator(this.operatorName);
      }
    });
    this.callback = this.broadcast.subscribeSelect(obj => {
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
    this.broadcast.unsubscribeSelect(this.callback);
  }

  // General

  public async save() {
    await this.operators.storeDefinition(this.operatorName, this.operatorDef.getDef());
    await this.visual.storeVisual(this.operatorName, this.operator.getVisual());
    this.isOperatorSaved = true;
    await this.operators.refresh();
    await this.loadOperator(this.operatorName);
    this.isOperatorSaved = false;
    this.ref.detectChanges();
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
      const newOperator = new OperatorInstance(this.operators, this.operatorName, 'Main', this.operatorDef, {}, null, def, dim);
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

  private updateInstance(ins: OperatorInstance) {
    this.broadcast.update(ins);
    // Also update connections
    this.operator.getConnections().forEach(conn => {
      if (conn.getSource().getOperator() === ins || conn.getDestination().getOperator() === ins) {
        this.broadcast.update(conn);
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

  public selectInstance(ins: OperatorInstance) {
    this.mouse.setDragging();
    this.selectedEntity.entity = ins;
    this.newInstanceName = ins.getName();
  }

  public isAnyEntitySelected(): boolean {
    return !!this.broadcast.getSelected();
  }

  public isSelected(entity: any): boolean {
    return this.isAnyEntitySelected() && this.broadcast.getSelected() === entity;
  }

  public genericNames(ins: OperatorInstance): Array<string> {
    return Array.from(ins.getGenericNames());
  }

  public displayUserMessage(msg: string) {
    this.userMessage = msg;
    this.ref.detectChanges();
    if (this.userMessageTimeout != null) {
      clearTimeout(this.userMessageTimeout);
    }
    const that = this;
    this.userMessageTimeout = setTimeout(function () {
      that.userMessage = '';
      that.ref.detectChanges();
    }, 5000);
  }

  public selectPort(port1: Port) {
    if (port1.isUnspecifiedGeneric()) {
      this.displayUserMessage(`Cannot connect unspecified generic port. Specify generic type '${port1.getGeneric()}'.`);
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
    this.broadcast.update(this.operator);
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

  public getOperatorList(): Array<OperatorDef> {
    return []
      .concat(
        Array.from(this.operators.getLocals().values()).filter(op => !this.operator || op !== this.operator.opDef),
        Array.from(this.operators.getLibraries().values()),
        Array.from(this.operators.getElementaries().values()));
  }

  public specifyGeneric(gens, name) {
    gens[name] = TypeDefFormComponent.newDefaultTypeDef('primitive');
  }

  public specifyProperty(props, name, def) {
    props[name] = createDefaultValue(def);
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

  public sidebarDefinitionChange() {
    this.refresh();
  }

}
