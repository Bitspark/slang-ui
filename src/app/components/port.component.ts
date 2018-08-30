import {Component, Input, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {generateSvgTransform} from '../utils';
import {Port, Transformable, Type} from '../classes/operator';
import {VisualService} from '../services/visual.service';
import {Orientation} from '../classes/vector';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortComponent implements OnDestroy {
  private callback: () => void;

  constructor(private cd: ChangeDetectorRef, public visual: VisualService) {
    cd.detach();
  }

  ngOnDestroy(): void {
    this.visual.unregisterCallback(this.port, this.callback);
  }

  @Input()
  public aspect: string;

  @Input()
  public port_: Port;

  @Input()
  set port(port: Port) {
    this.port_ = port;
    this.callback = this.visual.registerCallback(port, () => {
      this.cd.detectChanges();
    });
    this.cd.detectChanges();
  }

  get port() {
    return this.port_;
  }

  public getCSSClass(): any {
    const cssClass = {};

    cssClass['selected'] = this.visual.isSelected(this.port);
    cssClass['hovered'] = this.visual.isHovered(this.port);

    cssClass[Type[this.port.getType()]] = true;
    cssClass[this.port.getOrientation().name()] = true;

    cssClass['in'] = this.port.isIn();
    cssClass['out'] = this.port.isOut();

    return cssClass;
  }

  public getEntries(): Array<Port> {
    return Array.from(this.port.getMap().values());
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public translatePort(): string {
    const outer = this.port.getOperator().getParent() || this.port.getOperator();
    return `translate(${this.port.getCenterX(outer)},${this.port.getCenterY(outer)})`;
  }

  public transformLabel(): string {
    return `rotate(-55 ${this.getPortLabelX()},${this.getPortLabelY()})`;
  }

  public getPortLabelX(): number {
    switch (this.port.getOrientation().value()) {
      case Orientation.north:
        return 0;
      case Orientation.west:
        return 15;
      case Orientation.south:
        return 0;
      case Orientation.east:
        return -15;
    }
  }

  public getPortLabelY(): number {
    switch (this.port.getOrientation().value()) {
      case Orientation.north:
        return 15;
      case Orientation.west:
        return 0;
      case Orientation.south:
        return -15;
      case Orientation.east:
        return 0;
    }
  }

  public getPortLabelAnchor(): string {
    switch (this.port.getOrientation().value()) {
      case Orientation.north:
        return 'end';
      case Orientation.west:
        return 'begin';
      case Orientation.south:
        return 'begin';
      case Orientation.east:
        return 'end';
    }
  }

  public getPortLabelCSSClass(): any {
    const cssClasses = {};
    cssClasses['displayed'] = this.visual.isHovered(this.port) || this.visual.isSelected(this.port);
    return cssClasses;
  }
}
