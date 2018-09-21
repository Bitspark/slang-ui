import {Component, ChangeDetectionStrategy, Input, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {Connection, OperatorInstance, Type} from '../classes/operator';
import {SVGConnectionLineGenerator} from '../utils';
import {BroadcastService} from '../services/broadcast.service';

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

  constructor(private cd: ChangeDetectorRef, public broadcast: BroadcastService) {
    cd.detach();
  }

  public connectionPoints(): string {
    return SVGConnectionLineGenerator.generateRoundPath(this.instance, this.connection);
  }

  public getCSSClass(): any {
    const cssClass = {};

    cssClass['selected'] = this.broadcast.isSelected(this.connection);
    cssClass['hovered'] = this.broadcast.isHovered(this.connection);

    return cssClass;
  }

  public normalVisible(): boolean {
    return !this.broadcast.isSelected(this.connection) && !this.broadcast.isHovered(this.connection);
  }

  private subscribe() {
    this.callback = this.broadcast.registerCallback(this.connection, () => {
      this.cd.detectChanges();
    });
    this.cd.detectChanges();
  }

  ngOnDestroy(): void {
    this.broadcast.unregisterCallback(this.connection, this.callback);
  }

}
