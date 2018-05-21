import {Component, Input, OnInit} from '@angular/core';
import {OperatorDef, Port, PortType} from '../classes/operator';

@Component({
  selector: 'app-type-def-form',
  templateUrl: './type-def-form.component.html',
  styleUrls: ['./type-def-form.component.css']
})
export class TypeDefFormComponent implements OnInit {
  @Input()
  public port: any = {
    type: 'primitive'
  };
  public portTypes = Object.keys(PortType).filter(t => typeof PortType[t] === 'number');

  constructor() {
  }

  ngOnInit() {
  }

  public setType(portType: string) {
    this.port[portType] = {
      type: 'primitive'
    };
    this.port.type = portType;
  }

  public isMap(): boolean {
    return OperatorDef.isMap(this.port);

  }

  public isStream(): boolean {
    return OperatorDef.isStream(this.port);
  }

  public isGeneric(): boolean {
    return OperatorDef.isGeneric(this.port);
  }
}
