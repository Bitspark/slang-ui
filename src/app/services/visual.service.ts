import {Injectable} from '@angular/core';
import {ApiService} from './api.service';

@Injectable()
export class VisualService {
  constructor(private api: ApiService) {

  }

  public loadVisual(opName: string): Promise<any> {
    return new Promise<any>(async resolve => {
      const resp = await this.api.get('operator/meta/visual/', {fqop: opName});
      resolve(resp['data']);
    });
  }

  public async storeVisual(opName: string, visual: any) {
    return new Promise<void>(async resolve => {
      await this.api.post('operator/meta/visual/', {fqop: opName}, visual);
      resolve();
    });
  }
}
