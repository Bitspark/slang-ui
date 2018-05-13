import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {OperatorDef, OperatorInstance, Transformable} from '../classes/operator';
import {safeDump, safeLoad} from 'js-yaml';
import {generateSvgTransform} from '../utils';

@Component({
  templateUrl: './operator.component.html',
  styleUrls: []
})
export class OperatorComponent implements OnInit {
  // General
  public operatorName = '';
  public operator: OperatorDef = null;
  public status;

  // YAML
  public yamlRepr = '';

  // Visual
  public visualInsts = new Map<string, OperatorInstance>();
  public visualSelectedInst: OperatorInstance = null;

  // Dragging
  private dragging = false;
  private lastX: number;
  private lastY: number;

  constructor(private route: ActivatedRoute, public operators: OperatorService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.operatorName = routeParams.operatorName;
      this.operator = this.operators.getLocal(routeParams.operatorName);
      if (this.operator) {
        this.updateDef(this.operator.getDef());
      } else {
        this.status = `Operator "${this.operatorName}" not found.`;
      }
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.operator = this.operators.getLocal(this.operatorName);
        if (this.operator) {
          this.updateDef(this.operator.getDef());
        } else {
          this.status = `Operator "${this.operatorName}" not found.`;
        }
      }
    });
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
    this.operator.setDef(def);
    this.status = `Updated definition of operator "${this.operatorName}".`;
    this.displayYaml();
    this.displayVisual();
  }

  private displayYaml() {
    this.yamlRepr = safeDump(this.operator.getDef());
  }

  // Visual

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public visualInstances() {
    return Array.from(this.visualInsts.values()).filter(ins => ins.isVisible());
  }

  public selectVisualInstance(ins: OperatorInstance) {
    this.visualSelectedInst = ins;
  }

  private displayVisual() {
    const def = this.operator.getDef();
    this.visualInsts.forEach(ins => ins.hide());
    for (const insName in def.operators) {
      if (def.operators.hasOwnProperty(insName)) {
        const ins = def.operators[insName];
        let opName = ins.operator;
        if (opName.startsWith('.')) {
          const opSplit = this.operatorName.split('.');
          opSplit[opSplit.length - 1] = opName.substr(1);
          opName = opSplit.join('.');
        }
        const op = this.operators.getOperator(opName);
        let visualIns = this.visualInsts.get(insName);
        const pos: [number, number] = [Math.random() * 600, Math.random() * 400];
        if (typeof visualIns !== 'undefined') {
          pos[0] = visualIns.getPosX();
          pos[1] = visualIns.getPosY();
        }
        const opDef = JSON.parse(JSON.stringify(op.getDef()));
        OperatorDef.specifyOperatorDef(opDef, ins['generics'], ins['properties'], opDef['properties']);
        visualIns = new OperatorInstance(insName, null, pos, [1, 1], 0, opDef);
        this.visualInsts.set(insName, visualIns);
        visualIns.show();
      }
    }
  }

  public addInstance(op: any) {
    const def = this.operator.getDef();
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
      this.visualSelectedInst.move([event.screenX - this.lastX, event.screenY - this.lastY]);
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
