import {Component, HostListener, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Composable, Connection, OperatorDef, OperatorInstance, Port, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {compareOperatorDefs, createDefaultValue, generateSvgTransform, normalizeConnections, stringifyConnections} from '../utils';
import {ApiService} from '../services/api.service';
import {VisualService} from '../services/visual.service';
import 'codemirror/mode/yaml/yaml.js';
import {TypeDefFormComponent} from './type-def-form.component';

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
  public status;
  public showInOutPorts = false;

  // YAML
  public yamlRepr = '';
  public uiMode = 'visual';
  public editorConfig = {
    theme: 'default',
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

  // Dragging
  private dragging = false;
  private lastX: number;
  private lastY: number;
  private insPropDefs = new Map<string, Array<{ name: string, def: any }>>();

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
        if (this.selectedEntity.entity.constructor.name === OperatorInstance.name) {
          this.removeInstance(this.selectedEntity.entity);
          this.selectedEntity.entity = null;
          break;
        }
        if (this.selectedEntity.entity.constructor.name === Connection.name) {
          this.removeConnection(this.selectedEntity.entity);
          this.selectedEntity.entity = null;
          break;
        }
        break;
    }
  }

  constructor(private route: ActivatedRoute, public operators: OperatorService, public visuals: VisualService, public api: ApiService) {
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
    await this.visuals.storeVisual(this.operators.getWorkingDir(), this.operatorName, this.operator.getVisual());
    await this.operators.refresh();
    await this.loadOperator(this.operatorName);
  }

  public async loadOperator(operatorName) {
    this.operatorName = operatorName;
    this.operatorDef = this.operators.getLocal(this.operatorName);
    if (this.operatorDef) {
      const def = this.operatorDef.getDef();
      this.operator = new OperatorInstance(this.operators, this.operatorName, '', this.operatorDef, {}, null, def, [1200, 1100]);
      this.operator.translate([50, 50]);
      this.updateDef(def);
      const visual = await this.visuals.loadVisual(this.operators.getWorkingDir(), operatorName);
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
    return JSON.stringify(val);
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
    this.mainSrvPort = this.operatorDef.getDef().services.main;
    this.status = `Updated definition of operator "${this.operatorName}".`;
    this.refresh();
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
    this.selectedEntity.entity = ins;
  }

  public selectConnection(conn: Connection) {
    this.selectedEntity.entity = conn;
  }

  public isInstanceSelected() {
    return this.selectedEntity.entity && this.selectedEntity.entity !== this.operator &&
      this.selectedEntity.entity.constructor.name === OperatorInstance.name;
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

  public genericNames(ins: OperatorInstance): Array<string> {
    return Array.from(ins.getGenericNames());
  }

  public selectPort(port1: Port) {
    if (this.selectedEntity.entity && this.selectedEntity.entity.constructor.name === Port.name) {
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
    this.operator.updateOperator(def);
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

  public getPorts(): Array<Port> {
    if (this.operator) {
      return this.operator.getPrimitivePorts();
    } else {
      return [];
    }
  }

  public getPortLabelX(port: Port): number {
    const ori = port.getOrientation();
    if (ori === 0) {
      // to north
      return 10;
    } else if (ori === 1) {
      // to west
      return 25;
    } else if (ori === 3) {
      // to east
      return -25;
    } else {
      // to south
      return 10;
    }
  }

  public getPortLabelY(port: Port): number {
    const ori = port.getOrientation();
    if (ori === 0) {
      // to north
      return 20;
    } else if (ori === 1) {
      // to west
      return -10;
    } else if (ori === 3) {
      // to east
      return -10;
    } else {
      // to south
      return -20;
    }
  }

  public getPortLabelAnchor(port: Port): string {
    const ori = port.getOrientation();
    if (ori === 0) {
      // to north
      return 'end';
    } else if (ori === 3) {
      // to west
      return 'end';
    } else if (ori === 1) {
      // to east
      return 'begin';
    } else {
      // to south
      return 'begin';
    }
  }

  public getLocals(filterString: string): Array<OperatorDef> {
    return Array
      .from(this.operators.getLocals().values())
      .filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
  }

  public getGlobals(filterString: string): Array<OperatorDef> {
    return []
      .concat(
        Array.from(this.operators.getLibraries().values()),
        Array.from(this.operators.getElementaries().values()))
      .filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
  }

  public getElementaries(filterString: string): Array<OperatorDef> {
    return Array
      .from(this.operators.getElementaries().values())
      .filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
  }

  public getLibraries(filterString: string): Array<OperatorDef> {
    return Array
      .from(this.operators.getLibraries().values())
      .filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
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

  // Dragging

  private updateDrag(event, update?: boolean) {
    if (this.selectedEntity.entity && typeof this.selectedEntity.entity.translate === 'function' && update) {
      this.selectedEntity.entity.translate([(event.screenX - this.lastX) / this.scale, (event.screenY - this.lastY) / this.scale]);
    }
    this.lastX = event.screenX;
    this.lastY = event.screenY;
  }

  public startDrag(event: any) {
    this.dragging = true;
    this.updateDrag(event);
  }

  public stopDrag(event: any) {
    this.dragging = false;
    this.updateDrag(event, true);
  }

  public drag(event: any) {
    if (event.buttons === 0) {
      this.dragging = false;
    }
    if (this.dragging) {
      this.updateDrag(event, true);
    }
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
}
