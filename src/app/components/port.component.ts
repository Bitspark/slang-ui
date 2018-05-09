import {Component, Input} from '@angular/core';
import {OperatorDef} from '../classes/operator-def.class';

@Component({
  selector: 'app-port,[app-port]',
  templateUrl: './port.component.svg.html',
  styleUrls: []
})
export class PortComponent {

  @Input()
  public typeDef: any = {};

  public isPrimitive(): boolean {
    return OperatorDef.isPrimitive(this.typeDef) || this.typeDef['type'] === 'generic';
  }

  public isStream(): boolean {
    return this.typeDef['type'] === 'stream';
  }

  public isMap(): boolean {
    return this.typeDef['type'] === 'map';
  }

  public getWidth(): number {
    return OperatorDef.calcPortWidth(this.typeDef);
  }

  public getHeight(): number {
    return OperatorDef.calcPortHeight(this.typeDef);
  }

  public getEntries(): Array<any> {
    const entries = [];
    let x = 0;
    for (const key in this.typeDef['map']) {
      if (this.typeDef['map'].hasOwnProperty(key)) {
        const entry = {
          name: key,
          x: x,
          typeDef: this.typeDef['map'][key]
        };
        entries.push(entry);
        x += OperatorDef.calcPortWidth(entry.typeDef) + 5;
      }
    }
    return entries;
  }

  public translateEntry(entry: any): string {
    return `translate(${entry.x},0)`;
  }

}
