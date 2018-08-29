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
  private callbacks: Map<Object, () => void> = new Map<Object, () => void>();

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
      await this.api.post(VisualService.pathMetaVisual, {fqop: opName}, visual);
      resolve();
    });
  }

  // CONNECTION

  public async hoverConnection(conn: Connection) {
    const oldConn = this.hoveredConnection;
    this.hoveredConnection = conn;
    this.callback(conn);
    this.callback(oldConn);
  }

  public async selectConnection(conn: Connection) {
    this.selectedConnection = conn;
  }

  public isConnectionHovered(conn: Connection) {
    return this.hoveredConnection === conn;
  }

  public isConnectionSelected(conn: Connection) {
    return this.selectedConnection === conn;
  }

  // PORT

  public async hoverPort(port: Port) {
    const oldPort = this.hoveredPort;
    this.hoveredPort = port;
    this.callback(port);
    this.callback(oldPort);
  }

  public async selectPort(port: Port) {
    const oldPort = this.selectedPort;
    this.selectedPort = port;
    this.callback(port);
    this.callback(oldPort);
  }

  public isPortHovered(port: Port) {
    return this.hoveredPort === port;
  }

  public isPortSelected(port: Port) {
    return this.selectedPort === port;
  }

  // INSTANCE

  // TODO: Implement

  // CALLBACK HANDLING

  public registerCallback(obj: Object, callback: () => void) {
    this.callbacks.set(obj,  callback);
  }

  private callback(obj: Object) {
    if (!obj) {
      return;
    }
    const callback = this.callbacks.get(obj);
    if (callback) {
      callback();
    }
  }

}
