import {Component} from '@angular/core';
import {OperatorService} from '../services/operator.service';

@Component({
  templateUrl: './index.component.html',
  styleUrls: []
})
export class IndexComponent {

  public workingDir = '';

  constructor (public operators: OperatorService) {

  }

  public async connect() {
    await this.operators.refresh(this.workingDir);
  }

}
