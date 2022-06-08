import {Component} from '@angular/core';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator';
import {Router} from '@angular/router';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import * as initialDef from '../initial-def.json';
import {FileUploader} from 'ng2-file-upload';
import {ApiService} from '../services/api.service';


@Component({
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class IndexComponent {

  public newOperatorName = '';
  public creatingOperatorFailed = false;

  public feedbackURL = 'https://bitspark.de/send-email';
  public feedbackEmail = '';
  public feedbackMessage = '';
  public feedbackThankYou = false;

  public uploader: FileUploader;

  constructor(private api: ApiService, private http: HttpClient, private router: Router, public operators: OperatorService) {
    this.uploader = new FileUploader({url: this.api.uploadUrl(), itemAlias: 'file'});
    this.uploader.onBeforeUploadItem = (item) => {
      item.withCredentials = false;
    };
  }

  public async refreshOperators() {
    await this.operators.refresh();
  }

  public async newOperator(newOperatorName: string) {
    const newOperator = new OperatorDef({
      def: JSON.parse(JSON.stringify(initialDef['default'])),
      type: 'local',
      saved: false
    });

    newOperator.setName(newOperatorName);

    this.creatingOperatorFailed = !await this.save(newOperator);
    if (!this.creatingOperatorFailed) {
      this.operators.addLocal(newOperator);
      await this.openOperator(newOperator);
    }
  }

  public async upload() {
    await this.uploader.uploadAll();
    const that = this;
    setTimeout(async function () {
      await that.refreshOperators();
    }, 2000);
  }

  public async save(opDef: OperatorDef): Promise<boolean> {
    return await this.operators.storeDefinition(opDef.getDef());
  }

  public async openOperator(operator: OperatorDef) {
    await this.router.navigate(['operator', operator.getId()]);
  }

  public getLocals(): Array<OperatorDef> {
    return Array
      .from(this.operators.getLocals().values());
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
