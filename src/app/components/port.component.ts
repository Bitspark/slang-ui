import {Component, EventEmitter, Input, Output} from '@angular/core';
import {generateSvgTransform} from '../utils';
import {Port, Transformable, Type} from '../classes/operator';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: []
})
export class PortComponent {
  public hovered: boolean;

  @Input()
  public port: Port;

  @Output()
  public select: EventEmitter<any> = new EventEmitter();
  @Input()
  public selectedEntity: any;

  public getCSSClass(): any {
    const cssClass = {};
    cssClass['selected'] = this.isSelected();
    cssClass[Type[this.port.getType()]] = true;
    cssClass[this.port.getOrientation().name()] = true;
    cssClass['in'] = this.port.isIn();
    cssClass['out'] = this.port.isOut();
    cssClass['hovered'] = this.hovered;
    return cssClass;
  }

  public isSelected() {
    return this.selectedEntity.entity && this.selectedEntity.entity === this.port;
  }

  public getEntries(): Array<Port> {
    return Array.from(this.port.getMap().values());
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }
}
