import {Component, Input, ChangeDetectorRef, ChangeDetectionStrategy} from '@angular/core';
import {generateSvgTransform} from '../utils';
import {Port, Transformable, Type} from '../classes/operator';
import {VisualService} from '../services/visual.service';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortComponent {
  constructor(private cd: ChangeDetectorRef, public visual: VisualService) {
    cd.detach();
  }

  @Input()
  public port_: Port;

  @Input()
  set port(port: Port) {
    this.port_ = port;
    this.visual.registerCallback(port, () => {
      this.cd.detectChanges();
    });
    this.cd.detectChanges();
  }

  get port() {
    return this.port_;
  }

  public getCSSClass(): any {
    const cssClass = {};

    cssClass['selected'] = this.visual.isPortSelected(this.port);
    cssClass['hovered'] = this.visual.isPortHovered(this.port);

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
}
