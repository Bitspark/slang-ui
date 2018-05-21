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
    if (portType === 'map') {
      this.port[portType] = new Map<string, any>();
    } else {
      this.port[portType] = TypeDefFormComponent.newPrimitiveTypeDef();
    }
    this.port.type = portType;
  }

  public getMapPortNames(): Array<string> {
    if (this.isMap()) {
      return Array.from(this.port.map.keys());
    }
    return [];
  }

  public addMapPort(portName: string) {
    if (!portName || this.port.map.has(portName)) {
      return;
    }

    this.port.map.set(portName, TypeDefFormComponent.newPrimitiveTypeDef());
    this.resetNewMapPortName();
  }

  public renameMapPortName(oldPortName, newPortName: string) {
    this.port.map.set(newPortName, this.port.map.get(oldPortName));
    this.removeMapPort(oldPortName);
  }

  public removeMapPort(portName: string) {
    this.port.map.delete(portName);
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
