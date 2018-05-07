import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator-def.class';

@Component({
  templateUrl: './operator.component.html',
  styleUrls: []
})
export class OperatorComponent implements OnInit {

  public operator: OperatorDef = null;

  constructor(private route: ActivatedRoute, public operators: OperatorService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.operator = this.operators.getLocal(routeParams.operatorName);
    });
  }

}
