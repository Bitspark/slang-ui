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

  public operatorName = '';
  public operator: OperatorDef = null;

  public yamlRepr = '';

  public visualInsts = [];

  public status;

  constructor(private route: ActivatedRoute, public operators: OperatorService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.operatorName = routeParams.operatorName;
      this.operator = this.operators.getLocal(routeParams.operatorName);
      this.updateDef(this.operator.getDef());
    });

    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.operator = this.operators.getLocal(this.operatorName);
        this.updateDef(this.operator.getDef());
      }
    });
  }

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
    this.displayYaml();
    this.displayVisual();
  }

  private displayYaml() {
    this.yamlRepr = safeDump(this.operator.getDef());
  }

  private displayVisual() {
    this.visualInsts = [];

    const def = this.operator.getDef();
    for (const insName in def.operators) {
      if (def.operators.hasOwnProperty(insName)) {
        const ins = def.operators[insName];
        console.log(ins);
      }
    }
  }

}
