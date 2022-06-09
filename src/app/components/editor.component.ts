import {Component, HostListener, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {animate, state, style, transition, trigger} from '@angular/animations';

import {ApiService} from '../services/api.service';
import {BroadcastService} from '../services/broadcast.service';
import {MouseService} from '../services/mouse.service';
import {OperatorService} from '../services/operator.service';
import {VisualService} from '../services/visual.service';

import {Connection, OperatorDef, OperatorInstance, Port} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {normalizeConnections, stringifyConnections} from '../utils';

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
  public operatorId = '';
  public operatorName = '';
  public operatorDef: OperatorDef = null;
  public operator: OperatorInstance = null;
  public debugState: string = null;
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
  public selectedEntity = {entity: null as any};
  public scale = 0.6;
  public isOperatorSaved = false;
  public canvasFocus = false;

  private insPropDefs = new Map<string, Array<{ name: string, def: any }>>();

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
        event.preventDefault();
        this.scale *= 1.1;
        this.ref.detectChanges();
        break;
      case '-':
        event.preventDefault();
        this.scale /= 1.1;
        this.ref.detectChanges();
        break;
      case 'Delete':
      case 'Backspace':
        const selectedEntity = this.broadcast.getSelected();
        if (!selectedEntity) {
          return;
        }
        event.preventDefault();
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
    this.route.params.subscribe(routeParams => {
      this.loadOperator(routeParams.operatorId);
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.loadOperator(this.operatorId);
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
    await this.operators.storeDefinition(this.operatorDef.getDef());
    await this.visual.storeVisual(this.operatorName, this.operator.getVisual());
    this.isOperatorSaved = true;
    await this.operators.refresh();
    await this.loadOperator(this.operatorId);
    this.isOperatorSaved = false;
    this.ref.detectChanges();
  }

  public download() {
    const url = this.api.downloadUrl(this.operator.getFullyQualifiedName());
    window.location.href = url;
  }

  public async loadOperator(operatorId) {
    this.operatorId = operatorId;
    this.broadcast.clearUpdateCallbacks();
    this.operatorDef = this.operators.getLocal(operatorId);

    if (this.operatorDef) {
      const def = this.operatorDef.getDef();
      this.operatorName = def.meta.name;

      const visual = await this.visual.loadVisual(this.operatorName);
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
      const newOperator = new OperatorInstance(this.operators, operatorId, '', this.operatorDef, {}, null, def, dim);
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
    }
    if (!this.callback) {
      console.log('subscribe');
      this.callback = this.broadcast.subscribeSelect(obj => {
        if (!obj) {
          this.selectedEntity.entity = null;
          return;
        }
        if (obj instanceof OperatorInstance) {
          this.selectInstance(obj);
        } else if (obj instanceof Port) {
          this.selectPort(obj);
        } else if (obj instanceof Connection) {
          this.selectConnection(obj);
        }
      });
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
    } catch (e) {}
  }

  private updateDef(def: any) {
    this.operatorDef.setDef(def);
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

  public selectConnection(conn: Connection) {
    this.selectedEntity.entity = conn;
  }

  public isAnyEntitySelected(): boolean {
    return !!this.broadcast.getSelected();
  }

  public isSelected(entity: any): boolean {
    return this.isAnyEntitySelected() && this.broadcast.getSelected() === entity;
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
            this.broadcast.select(null);
            return;
          } else if (port2.isIn() && port1.isOut()) {
            this.addConnection(port2, port1);
            this.broadcast.select(null);
            return;
          }
        } else {
          if (port1.isIn() && port2.isIn()) {
            this.addConnection(port1, port2);
            this.broadcast.select(null);
            return;
          } else if (port2.isOut() && port1.isOut()) {
            this.addConnection(port2, port1);
            this.broadcast.select(null);
            return;
          }
        }
      } else {
        if (port2.getOperator() === this.operator) {
          if (port2.isIn() && port1.isIn()) {
            this.addConnection(port2, port1);
            this.broadcast.select(null);
            return;
          } else if (port1.isOut() && port2.isOut()) {
            this.addConnection(port1, port2);
            this.broadcast.select(null);
            return;
          }
        } else {
          if (port1.isOut() && port2.isIn()) {
            this.addConnection(port1, port2);
            this.broadcast.select(null);
            return;
          } else if (port2.isOut() && port1.isIn()) {
            this.addConnection(port2, port1);
            this.broadcast.select(null);
            return;
          }
        }
      }
      this.selectedEntity.entity = port1;
      return;
    } else {
      this.selectedEntity.entity = port1;
    }
  }

  private displayVisual() {
    const def = this.operatorDef.getDef();
    this.operator.updateOperator(def, undefined);
    this.broadcast.update(this.operator);
  }

  public addInstance(opr: OperatorDef) {
    const def = this.operatorDef.getDef();
    const insName = this.getDistinctInstanceName(opr.getName());
    def.operators[insName] = {
      operator: opr.getId()
    };
    this.updateDef(def);
  }

  public getDistinctInstanceName(oprName: string) {
    const def = this.operatorDef.getDef();
    const cleanInsName = oprName.replace(/[^a-zA-Z]+/g, "");

    let insName = cleanInsName;
    let i = 1;
    if (!def.operators) {
      def.operators = {};
    }
    while (def.operators[insName]) {
      insName = cleanInsName + i;
      i++;
    }

    return insName;
  }

  public getOperatorList(): Array<OperatorDef> {
    return []
      .concat(
        Array.from(this.operators.getLocals().values()).filter(op => !this.operator || op !== this.operator.opDef),
        Array.from(this.operators.getLibraries().values()),
        Array.from(this.operators.getElementaries().values()));
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

  public sidebarDefinitionChange() {
    this.refresh();
  }

  public async startDebugging() {
    await this.save();
    this.debugState = 'startDebugging';
    this.ref.detectChanges();
  }

  public stopOperator() {
    this.debugState = 'stopOperator';
    this.ref.detectChanges();
  }

  public debugStateChanged(newState: string) {
    this.ref.detectChanges();
  }

  public running(): boolean {
    return ['debugging'].indexOf(this.debugState) !== -1;
  }

}
