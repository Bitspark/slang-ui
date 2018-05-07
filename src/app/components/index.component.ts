import {Component} from '@angular/core';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator-def.class';
import {Router} from '@angular/router';

@Component({
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.css']
})
export class IndexComponent {

  public workingDir = '';
  public newOperatorName = '';

  constructor (private router: Router, public operators: OperatorService) {
    this.workingDir = operators.getWorkingDir();
  }

  public async refreshOperators() {
    this.operators.setWorkingDir(this.workingDir);
    await this.operators.refresh();
  }

  public async newOperator() {
    const newOperator = new OperatorDef({name: this.newOperatorName, def: {}, type: 'local', saved: false});
    this.operators.addLocal(newOperator);
    await this.openOperator(newOperator);

    this.newOperatorName = '';
  }

  public async openOperator(operator: OperatorDef) {
    await this.router.navigate(['operator', operator.getName()]);
  }

}
