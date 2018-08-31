import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {Identifiable} from '../classes/operator';

@Injectable()
export class VisualService {
  private static pathMetaVisual = '/operator/meta/visual/';

  private selectedEntity: Identifiable = null;
  private hoveredEntity: Identifiable = null;

  private updateSubscriptions: Map<Object, Array<() => void>>;
  private selectEntitySubscriptions: Array<(Identifiable) => void>;

  constructor(private api: ApiService) {
    this.updateSubscriptions = new Map<Object, Array<() => void>>();
    this.selectEntitySubscriptions = [];
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
      await this.api.post(VisualService.pathMetaVisual, {fqop: opName}, visual);
      resolve();
    });
  }

  // HOVERING AND SELECTING

  public clear() {
    this.selectedEntity = null;
    this.hoveredEntity = null;
    this.updateSubscriptions = new Map<Object, Array<() => void>>();
    this.selectEntitySubscriptions = [];
  }

  public hover(obj: Identifiable) {
    const oldObj = this.hoveredEntity;
    this.hoveredEntity = obj;
    this.update(obj);
    this.update(oldObj);
  }

  public select(obj: Identifiable) {
    const oldObj = this.selectedEntity;
    this.selectedEntity = obj;
    this.update(obj);
    this.update(oldObj);
    this.broadcastSelect(obj);
  }

  public isHovered(obj: Identifiable): boolean {
    if (!this.hoveredEntity) {
      return false;
    }
    return this.hoveredEntity.getIdentity() === obj.getIdentity();
  }

  public isSelected(obj: Identifiable): boolean {
    if (!this.selectedEntity) {
      return false;
    }
    return this.selectedEntity.getIdentity() === obj.getIdentity();
  }

  public getHovered(): Identifiable {
    return this.hoveredEntity;
  }

  public getSelected(): Identifiable {
    return this.selectedEntity;
  }

  public subscribeSelect(callback: (Identifiable) => void): (Identifiable) => void {
    this.selectEntitySubscriptions.push(callback);
    return callback;
  }

  public unsubscribeSelect(callback: (Identifiable) => void) {
    const index = this.selectEntitySubscriptions.indexOf(callback);
    if (index !== -1) {
      this.selectEntitySubscriptions.splice(index, 1);
    }
  }

  private broadcastSelect(obj: Identifiable): void {
    for (const callback of this.selectEntitySubscriptions) {
      callback(obj);
    }
  }

  // CALLBACK HANDLING

  public registerCallback(obj: Identifiable, callback: () => void): () => void {
    const id = obj.getIdentity();
    const callbacks = this.updateSubscriptions.get(id);
    if (callbacks) {
      callbacks.push(callback);
    } else {
      this.updateSubscriptions.set(id, [callback]);
    }
    return callback;
  }

  public unregisterCallback(obj: Identifiable, callback: () => void) {
    const id = obj.getIdentity();
    const callbacks = this.updateSubscriptions.get(id);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  public update(obj: Identifiable) {
    if (!obj) {
      return;
    }
    const id = obj.getIdentity();
    const callbacks = this.updateSubscriptions.get(id);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    } else {
      console.log('no callbacks found for', id);
    }
  }

}
