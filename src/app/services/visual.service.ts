import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {Connection, OperatorInstance, Port} from '../classes/operator';

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

  public async hoverConnection(conn: Connection) {
    const oldConn = this.hoveredConnection;
    this.hoveredConnection = conn;
    this.update(conn);
    this.update(oldConn);
  }

  public async selectConnection(conn: Connection) {
    if (conn !== null) {
      this.unselectAll();
    }
    const oldConn = this.selectedConnection;
    this.selectedConnection = conn;
    this.update(conn);
    this.update(oldConn);
  }

  public isConnectionHovered(conn: Connection): boolean {
    return this.hoveredConnection === conn;
  }

  public isConnectionSelected(conn: Connection): boolean {
    return this.selectedConnection === conn;
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

  public async hoverPort(port: Port) {
    const oldPort = this.hoveredPort;
    this.hoveredPort = port;
    this.update(port);
    this.update(oldPort);
  }

  public async selectPort(port: Port) {
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
    return this.hoveredPort === port;
  }

  public isPortSelected(port: Port): boolean {
    return this.selectedPort === port;
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

  public registerCallback(obj: Object, callback: () => void) {
    const callbacks = this.updateCallbacks.get(obj);
    if (callbacks) {
      callbacks.push(callback);
    } else {
      this.updateCallbacks.set(obj, [callback]);
    }
  }

  public update(obj: Object) {
    if (!obj) {
      return;
    }
    const callbacks = this.updateCallbacks.get(obj);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

}
