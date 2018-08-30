import {Injectable} from '@angular/core';

@Injectable()
export class MouseService {

  private lastX: number;
  private lastY: number;

  private moving: boolean;
  private actionType = '';

  private callbacks: Array<(event: string, actionPhase: string) => void>;

  constructor() {
    this.callbacks = [];
  }

  public getLastX(): number {
    return this.lastX;
  }

  public getLastY(): number {
    return this.lastY;
  }

  public setResizing() {
    this.actionType = 'resize';
  }

  public setDragging() {
    this.actionType = 'drag';
  }

  public isResizing() {
    return this.actionType === 'resize';
  }

  public isDragging() {
    return this.actionType === 'drag';
  }

  public start(event: any) {
    this.moving = true;
    this.broadcast(event, 'start');
    this.lastX = event.screenX;
    this.lastY = event.screenY;
    return false;
  }

  public stop(event: any) {
    this.moving = false;
    this.broadcast(event, 'stop');
    this.lastX = event.screenX;
    this.lastY = event.screenY;
    this.actionType = '';
    return false;
  }

  public track(event: any) {
    if (event.buttons === 0) {
      this.moving = false;
    }
    if (this.moving) {
      this.broadcast(event, 'ongoing');
      this.lastX = event.screenX;
      this.lastY = event.screenY;
    }
    return false;
  }

  public subscribe(callback: (event: string, actionPhase: string) => void) {
    this.callbacks.push(callback);
  }

  private broadcast(event: string, actionPhase: string) {
    for (const callback of this.callbacks) {
      callback(event, actionPhase);
    }
  }

}
