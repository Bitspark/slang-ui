import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {Connection, Identifiable, OperatorInstance, Port} from '../classes/operator';

@Injectable()
export class VisualService {
  private static pathMetaVisual = '/operator/meta/visual/';

  private selectedConnection: Connection = null;
  private hoveredConnection: Connection = null;

  private selectedPort: Port = null;
  private hoveredPort: Port = null;

  private selectedInstance: OperatorInstance = null;
  private hoveredInstance: OperatorInstance = null;

  private updateCallbacks: Map<Object, Array<() => void>>;

  private selectPortSubscriptions: Array<(Port) => void>;
  private selectInstanceSubscriptions: Array<(OperatorInstance) => void>;

  constructor(private api: ApiService) {
    this.updateCallbacks = new Map<Object, Array<() => void>>();

    this.selectPortSubscriptions = [];
    this.selectInstanceSubscriptions = [];
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

  private unselectAll() {
    this.selectInstance(null);
    this.selectPort(null);
    this.selectConnection(null);
  }

  // CONNECTION

  public hoverConnection(conn: Connection) {
    const oldConn = this.hoveredConnection;
    this.hoveredConnection = conn;
    this.update(conn);
    this.update(oldConn);
  }

  public selectConnection(conn: Connection) {
    if (conn !== null) {
      this.unselectAll();
    }
    const oldConn = this.selectedConnection;
    this.selectedConnection = conn;
    this.update(conn);
    this.update(oldConn);
  }

  public isConnectionHovered(conn: Connection): boolean {
    if (!this.hoveredConnection) {
      return false;
    }
    return this.hoveredConnection.getIdentity() === conn.getIdentity();
  }

  public isConnectionSelected(conn: Connection): boolean {
    if (!this.selectedConnection) {
      return false;
    }
    return this.selectedConnection.getIdentity() === conn.getIdentity();
  }

  // PORT

  public subscribePortSelect(callback: (Port) => void) {
    this.selectPortSubscriptions.push(callback);
  }

  private broadcastPortSelect(port: Port): void {
    for (const callback of this.selectPortSubscriptions) {
      callback(port);
    }
  }

  public hoverPort(port: Port) {
    const oldPort = this.hoveredPort;
    this.hoveredPort = port;
    this.update(port);
    this.update(oldPort);
  }

  public selectPort(port: Port) {
    if (port !== null) {
      this.broadcastPortSelect(port);
      this.unselectAll();
    }
    const oldPort = this.selectedPort;
    this.selectedPort = port;
    this.update(port);
    this.update(oldPort);
  }

  public isPortHovered(port: Port): boolean {
    if (!this.hoveredPort) {
      return false;
    }
    return this.hoveredPort.getIdentity() === port.getIdentity();
  }

  public isPortSelected(port: Port): boolean {
    if (!this.selectedPort) {
      return false;
    }
    return this.selectedPort.getIdentity() === port.getIdentity();
  }

  // INSTANCE

  public subscribeInstanceSelect(callback: (OperatorInstance) => void) {
    this.selectInstanceSubscriptions.push(callback);
  }

  private broadcastInstanceSelect(ins: OperatorInstance): void {
    for (const callback of this.selectInstanceSubscriptions) {
      callback(ins);
    }
  }

  public hoverInstance(ins: OperatorInstance) {
    const oldInstance = this.hoveredInstance;
    this.hoveredInstance = ins;
    this.update(ins);
    this.update(oldInstance);
  }

  public selectInstance(ins: OperatorInstance) {
    if (ins !== null) {
      this.broadcastInstanceSelect(ins);
      this.unselectAll();
    }
    const oldInstance = this.selectedInstance;
    this.selectedInstance = ins;
    this.update(ins);
    this.update(oldInstance);
  }

  public isInstanceHovered(ins: OperatorInstance): boolean {
    return this.hoveredInstance === ins;
  }

  public isInstanceSelected(ins: OperatorInstance): boolean {
    return this.selectedInstance === ins;
  }

  public getSelectedInstance(): OperatorInstance {
    return this.selectedInstance;
  }

  // CALLBACK HANDLING

  public registerCallback(obj: Identifiable, callback: () => void): () => void {
    const id = obj.getIdentity();
    const callbacks = this.updateCallbacks.get(id);
    if (callbacks) {
      callbacks.push(callback);
    } else {
      this.updateCallbacks.set(id, [callback]);
    }
    return callback;
  }

  public unregisterCallback(obj: Identifiable, callback: () => void) {
    const id = obj.getIdentity();
    const callbacks = this.updateCallbacks.get(id);
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
    const callbacks = this.updateCallbacks.get(id);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    } else {
      console.log('no callbacks found for', id);
    }
  }

}
