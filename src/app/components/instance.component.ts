import {Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {Connection, OperatorInstance, Transformable} from '../classes/operator';
import {generateSvgTransform} from '../utils';
import {VisualService} from "../services/visual.service";
import {MouseService} from "../services/mouse.service";
import {BroadcastService} from "../services/broadcast.service";

@Component({
  selector: 'app-instance,[app-instance]',
  templateUrl: './instance.component.svg.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceComponent implements OnInit, OnDestroy {
  private callback: () => void;

  @Input()
  public aspect: string;

  public instance_: OperatorInstance;

  @Input()
  set instance(ins: OperatorInstance) {
    this.instance_ = ins;
    this.callback = this.broadcast.registerCallback(ins, () => {
      this.ref.detectChanges();
    });
    this.ref.detectChanges();
  }

  get instance() {
    return this.instance_;
  }

  private fqn = '';

  public constructor(private ref: ChangeDetectorRef, public broadcast: BroadcastService, public mouse: MouseService) {
    ref.detach();
  }

  public getCSSClass(): any {
    const cssClass = {};
    cssClass['selected'] = this.broadcast.isSelected(this.instance);
    cssClass['hovered'] = this.broadcast.isHovered(this.instance);
    cssClass['sl-svg-op-type'] = true;
    cssClass[this.instance.getOperatorType()] = true;
    return cssClass;
  }

  public ngOnInit() {
    this.fqn = this.instance.getFullyQualifiedName();
    this.ref.detectChanges();
  }

  ngOnDestroy(): void {
    this.broadcast.unregisterCallback(this.instance, this.callback);
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public form(): string {
    switch (this.fqn) {
      case 'slang.data.Value':
        return 'circle';
      default:
        return 'rect';
    }
  }

  public radius(): number {
    return Math.max(this.instance.getWidth(), this.instance.getHeight()) / 2;
  }

  public text(): string {
    const fqn = this.instance.getFullyQualifiedName();
    const props = this.instance.getProperties();

    switch (fqn) {
      case 'slang.data.Value':
        return !!props ? JSON.stringify(props['value']) : 'value?';
      case 'slang.data.Evaluate':
        return !!props ? props['expression'] : 'eval?';
      case 'slang.data.Convert':
        return '';
      default:
        return this.instance.lastName();
    }
  }

  public visualInstances(): Array<OperatorInstance> {
    return Array.from(this.instance.getInstances().values()).filter(ins => ins.isVisible());
  }

  public visualConnections(): Array<Connection> {
    return Array.from(this.instance.getConnections().values());
  }

}
