import {Component, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {Connection, OperatorInstance, Type} from '../classes/operator';
import {VisualService} from '../services/visual.service';
import {SVGConnectionLineGenerator} from '../utils';

@Component({
  selector: 'app-connection,[app-connection]',
  templateUrl: './connection.component.svg.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectionComponent implements OnDestroy {
  private callback: () => void;

  @Input()
  public instance: OperatorInstance;

  private connection_: Connection;

  @Input()
  set connection(conn: Connection) {
    this.connection_ = conn;
    if (this.aspect) {
      this.subscribe();
    }
  }

  get connection() {
    return this.connection_;
  }

  public aspect_: string;

  @Input()
  set aspect(a: string) {
    this.aspect_ = a;
    if (this.connection) {
      this.subscribe();
    }
  }

  get aspect(): string {
    return this.aspect_;
  }

  constructor(private cd: ChangeDetectorRef, public visual: VisualService) {
    cd.detach();
  }

  public connectionPoints(): string {
    return SVGConnectionLineGenerator.generateRoundPath(this.instance, this.connection);
  }

  public getCSSClass(): any {
    const cssClass = {};

    cssClass['selected'] = this.visual.isConnectionSelected(this.connection);
    cssClass['hovered'] = this.visual.isConnectionHovered(this.connection);

    return cssClass;
  }

  public normalVisible(): boolean {
    return !this.visual.isConnectionSelected(this.connection) && !this.visual.isConnectionHovered(this.connection);
  }

  private subscribe() {
    this.callback = this.visual.registerCallback(this.connection, () => {
      this.cd.detectChanges();
    });
    this.cd.detectChanges();
  }

  ngOnDestroy(): void {
    this.visual.unregisterCallback(this.connection, this.callback);
  }

}
