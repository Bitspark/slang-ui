import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {Identifiable} from '../classes/operator';
import { resolve } from 'url';

@Injectable()
export class VisualService {
  private static pathMetaVisual = '/operator/meta/visual/';

  constructor(private api: ApiService) {
  }

  public loadVisual(opName: string): Promise<any> {
    return new Promise<any>(async resolve => {
      const resp = await this.api.get(VisualService.pathMetaVisual, {fqop: opName}).catch(
        err => {
          return;
        }
      );
      if (resp) {
        resolve(resp['data']);
      }
      resolve();
    });
  }

  public async storeVisual(opName: string, visual: any) {
    return new Promise<void>(async resolve => {
      //await this.api.post(VisualService.pathMetaVisual, {fqop: opName}, visual);
      resolve();
    });
  }

}
