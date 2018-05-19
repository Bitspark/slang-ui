import {Component, HostListener, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {Connection, OperatorDef, OperatorInstance, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {generateSvgTransform} from '../utils';
import {ApiService} from '../services/api.service';

@Component({
  templateUrl: './operator.component.html',
  styleUrls: ['./operator.component.css']
})
export class OperatorComponent implements OnInit {
  // General
  public operatorName = '';
  public operatorDef: OperatorDef = null;
  public operator: OperatorInstance = null;
  public status;

  // YAML
  public yamlRepr = '';

  // Visual
  public visualSelectedInst: OperatorInstance = null;
  public scale = 0.6;

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
    }
  }

  constructor(private route: ActivatedRoute, public operators: OperatorService, public api: ApiService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.operatorName = routeParams.operatorName;
      this.operatorDef = this.operators.getLocal(routeParams.operatorName);
      if (this.operatorDef) {
        const def = this.operatorDef.getDef();
        this.operator = new OperatorInstance(this.operators, this.operatorName, '', null, [0, 0], [1, 1], 0, def);
        this.updateDef(this.operatorDef.getDef());
      } else {
        this.status = `Operator "${this.operatorName}" not found.`;
      }
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.operatorDef = this.operators.getLocal(this.operatorName);
        if (this.operatorDef) {
          const def = this.operatorDef.getDef();
          this.operator = new OperatorInstance(this.operators, this.operatorName, '', null, [0, 0], [1, 1], 0, def);
          this.updateDef(def);
        } else {
          this.status = `Operator "${this.operatorName}" not found.`;
        }
      }
    });
  }

  // General

  public save() {
    this.api.post('visual/', {cwd: this.operators.getWorkingDir(), fqop: this.operatorName}, {test: 'test'});
  }

  // YAML

  public updateYaml(newYaml) {
    this.yamlRepr = newYaml;
  }

  public storeYaml() {
    try {
      const newDef = safeLoad(this.yamlRepr);
      this.updateDef(newDef);
      this.status = 'Parsed YAML successfully.';
    } catch (e) {
      this.status = e.toString();
    }
  }

  private updateDef(def: any) {
    this.operatorDef.setDef(def);
    this.status = `Updated definition of operator "${this.operatorName}".`;
    this.displayYaml();
    this.displayVisual();
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
    this.operator.getInstances().forEach(ins => ins.hide());
    this.operator.updateInstances(def.operators, def.connections);
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

  // Dragging

  private updateDrag(event, update?: boolean) {
    if (this.visualSelectedInst && update) {
      this.visualSelectedInst.move([(event.screenX - this.lastX) / this.scale, (event.screenY - this.lastY) / this.scale]);
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
