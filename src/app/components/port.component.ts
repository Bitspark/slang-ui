import {Component, EventEmitter, Input, Output} from '@angular/core';
import {generateSvgTransform} from '../utils';
import {Port, Transformable} from '../classes/operator';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: []
})
export class PortComponent {

  @Input()
  public port: Port;

  @Output()
  public select: EventEmitter<any> = new EventEmitter();
  @Input()
  public selectedEntity: any;

  public getEntries(): Array<Port> {
    return Array.from(this.port.getMap().values());
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }
}
