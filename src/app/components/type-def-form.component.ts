import {Component, Input, OnInit} from '@angular/core';
import {OperatorDef, PortType} from '../classes/operator';

@Component({
  selector: 'app-type-def-form',
  templateUrl: './type-def-form.component.html',
  styleUrls: ['./type-def-form.component.css']
})
export class TypeDefFormComponent implements OnInit {
  @Input()
  public port: any = TypeDefFormComponent.newPrimitiveTypeDef();
  public portTypes = Object.keys(PortType).filter(t => typeof PortType[t] === 'number');
  public newMapPortName: string;

  constructor() {
  }

  public static newPrimitiveTypeDef(): any {
    return {
      type: 'primitive'
    };
  }

  ngOnInit() {
  }

  public setType(portType: string) {
    this.port.type = portType;
    switch (portType) {
      case 'map':
        this.port[portType] = {};
        break;
      case 'generic':
        this.port[portType] = 'itemType';
        break;
      default:
        this.port[portType] = TypeDefFormComponent.newPrimitiveTypeDef();
    }
  }

  public getMapPortNames(): Array<string> {
    if (this.isMap()) {
      return Array.from(Object.keys(this.port.map)).filter(k => this.port.map.hasOwnProperty(k));
    }
    return [];
  }

  public addMapPort(portName: string) {
    if (!portName || this.port.map[portName]) {
      return;
    }
    this.port.map[portName] = TypeDefFormComponent.newPrimitiveTypeDef();
    this.resetNewMapPortName();
  }

  public renameMapPortName(oldPortName, newPortName: string) {
    this.port.map[newPortName] = this.port.map[oldPortName];
    this.removeMapPort(oldPortName);
  }

  public removeMapPort(portName: string) {
    delete this.port.map[portName];
  }

  public resetNewMapPortName() {
    this.newMapPortName = '';
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
