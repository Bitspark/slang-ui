import {Component, Input} from '@angular/core';
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

  public getEntries(): Array<Port> {
    return Array.from(this.port.getMap().values());
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public color(): string {
    switch (this.port.getType()) {
      case 'primitive':
        return 'violet';
      case 'number':
        return 'green';
      case 'string':
        return 'cyan';
      case 'boolean':
        return 'red';
      case 'binary':
        return 'yellow';
      case 'trigger':
        return 'gray';
      case 'generic':
        return 'purple';
    }
  }
}
