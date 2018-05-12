import {Component, Input} from '@angular/core';
import {OperatorDef} from '../classes/operator-def.class';
import {Port, Transformable} from './operator.component';
import {generateSvgTransform} from '../utils';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: []
})
export class PortComponent {

  @Input()
  public port: Port;

  public isPrimitive(): boolean {
    return OperatorDef.isPrimitive(this.port) || this.port['type'] === 'generic';
  }

  public getEntries(): Array<Port> {
    return Array.from(this.port.getMap().values());
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }
}
