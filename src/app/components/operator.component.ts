import {Component, HostListener, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Connection, OperatorDef, OperatorInstance, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {generateSvgTransform} from '../utils';
import {ApiService} from '../services/api.service';
import {VisualService} from '../services/visual.service';
import 'codemirror/mode/yaml/yaml.js';

@Component({
  templateUrl: './operator.component.html',
  styleUrls: ['./operator.component.css']
})
export class OperatorComponent implements OnInit {
  // General
  public operatorName = '';
  public operatorDef: OperatorDef = null;
  public operator: OperatorInstance = null;
  public mainSrvPort: any = null;
  public status;

  // YAML
  public yamlRepr = '';
  public editorConfig = {
    theme: 'default',
    mode: 'text/x-yaml',
    lineNumbers: true,
  };

  // Visual
  public visualSelectedInst: OperatorInstance = null;
  public scale = 0.6;
  public filterString = '';

  // Dragging
  private dragging = false;
  private lastX: number;
  private lastY: number;

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
        this.removeInstance(this.visualSelectedInst);
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
      this.operator = new OperatorInstance(this.operators, this.operatorName, '', null, def, [1200, 1100]);
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

  // YAML
  public refresh() {
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
  }

  private displayYaml() {
    this.yamlRepr = safeDump(this.operatorDef.getDef());
  }

  // Visual

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
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

  public selectVisualInstance(ins: OperatorInstance) {
    this.visualSelectedInst = ins;
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

  public getLocals(filterString: string): Array<OperatorDef> {
    return this.operators.getLocals().filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1);
  }

  public getElementaries(filterString: string): Array<OperatorDef> {
    return this.operators.getElementaries().filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1);
  }

  public getLibraries(filterString: string): Array<OperatorDef> {
    return this.operators.getLibraries().filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1);
  }

  // Dragging

  private updateDrag(event, update?: boolean) {
    if (this.visualSelectedInst && update) {
      this.visualSelectedInst.translate([(event.screenX - this.lastX) / this.scale, (event.screenY - this.lastY) / this.scale]);
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

}
