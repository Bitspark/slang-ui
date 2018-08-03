import {Component} from '@angular/core';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator';
import {Router} from '@angular/router';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import * as initialDef from '../initial-def.json';
import {compareOperatorDefs} from '../utils';


@Component({
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class IndexComponent {

  public newOperatorName = '';
  public creatingOperatorFailed = false;
  public filterString = '';

  public feedbackURL = 'https://bitspark.de/send-email';
  public feedbackEmail = '';
  public feedbackMessage = '';
  public feedbackThankYou = false;

  constructor(private http: HttpClient, private router: Router, public operators: OperatorService) {
  }

  public async refreshOperators() {
    await this.operators.refresh();
  }

  public async newOperator(newOperatorName: string) {
    const newOperator = new OperatorDef({
      name: newOperatorName,
      def: JSON.parse(JSON.stringify(initialDef['default'])),
      type: 'local',
      saved: false
    });

    this.creatingOperatorFailed = !await this.save(newOperator);
    if (!this.creatingOperatorFailed) {
      this.operators.addLocal(newOperator);
      await this.openOperator(newOperator);
    }
  }

  public async save(opDef: OperatorDef): Promise<boolean> {
    return await this.operators.storeDefinition(opDef.getName(), opDef.getDef());
  }

  public async openOperator(operator: OperatorDef) {
    await this.router.navigate(['operator', operator.getName()]);
  }

  public getLocals(filterString: string): Array<OperatorDef> {
    return Array
      .from(this.operators.getLocals().values())
      .filter(op => op.getName().toLowerCase().indexOf(filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
  }

  public getElementaries(): Array<OperatorDef> {
    return Array
      .from(this.operators.getElementaries().values())
      .sort(compareOperatorDefs);
  }

  public getLibraries(): Array<OperatorDef> {
    return Array
      .from(this.operators.getLibraries().values())
      .sort(compareOperatorDefs);
  }

  public sendFeedback() {
    const body = new HttpParams()
      .set('email', this.feedbackEmail)
      .set('message', this.feedbackMessage);

    this.http.post(this.feedbackURL, body.toString(), {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/x-www-form-urlencoded')
    }).toPromise().then(response => {
      if (response) {
        this.feedbackEmail = '';
        this.feedbackMessage = '';
        this.feedbackThankYou = true;
      }
    });
  }

}
