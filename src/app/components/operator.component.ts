import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator-def.class';
import {safeDump, safeLoad} from 'js-yaml';

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
  public visualInsts = {};
  public visualSelectedInst = null;

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

  public translateInstance(ins: any) {
    return `translate(${Math.round(ins.posX)},${Math.round(ins.posY)})`;
  }

  public visualInstances() {
    const instances = [];
    for (const insName in this.visualInsts) {
      if (this.visualInsts.hasOwnProperty(insName) && this.visualInsts[insName].visible) {
        instances.push(this.visualInsts[insName]);
      }
    }
    return instances;
  }

  public selectVisualInstance(ins: any) {
    for (const insName in this.visualInsts) {
      if (this.visualInsts.hasOwnProperty(insName)) {
        this.visualInsts[insName].selected = false;
      }
    }
    ins.selected = true;
    this.visualSelectedInst = ins;
  }

  private displayVisual() {
    const def = this.operator.getDef();
    for (const insName in this.visualInsts) {
      if (this.visualInsts.hasOwnProperty(insName)) {
        this.visualInsts[insName].visible = false;
      }
    }
    for (const insName in def.operators) {
      if (def.operators.hasOwnProperty(insName)) {
        const ins = def.operators[insName];
        let visualIns = this.visualInsts[insName];
        if (typeof visualIns === 'undefined') {
          visualIns = {
            name: insName,
            posX: Math.random() * 600,
            posY: Math.random() * 400
          };
          this.visualInsts[insName] = visualIns;
        }
        visualIns.visible = true;
      }
    }
  }

  // Dragging

  private updateDrag(event, update?: boolean) {
    if (update) {
      this.visualSelectedInst.posX += (event.screenX - this.lastX);
      this.visualSelectedInst.posY += (event.screenY - this.lastY);
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
