import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {OperatorDef, PortType} from '../classes/operator';

@Component({
  selector: 'app-type-def-form',
  templateUrl: './type-def-form.component.html',
  styleUrls: ['./type-def-form.component.css']
})
export class TypeDefFormComponent implements OnInit {
  @Input()
  public port: any = TypeDefFormComponent.newPrimitiveTypeDef();
  public intTypeDef: any;
  @Output() typeDefChanged: EventEmitter<any> = new EventEmitter();

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
    this.intTypeDef = this.mapExt2IntTypeDef(this.port);
  }

  public mapExt2IntTypeDef(extTDef: any): Array<any> {
    let intTDef;
    if (OperatorDef.isMap(extTDef)) {
      intTDef = {
        type: 'map',
        map: this.getMapPortNames2(extTDef).map(portName => {
          return {name: portName, def: this.mapExt2IntTypeDef(extTDef.map[portName])};
        })
      };
    } else {
      intTDef = {
        type: extTDef.type,
      };
      if (extTDef.hasOwnProperty(extTDef.type)) {
        intTDef[extTDef.type] = this.mapExt2IntTypeDef(extTDef[extTDef.type]);
      }
    }
    return intTDef;
  }

  public mapInt2ExtTypeDef(intTDef: any, extTDef?: any): Array<any> {
    if (!extTDef) {
      extTDef = {};
    }
    if (OperatorDef.isMap(intTDef)) {
      const map = {};
      intTDef.map.forEach(curr => {
        map[curr.name] = this.mapInt2ExtTypeDef(curr.def);
      });
      extTDef.map = map;
      extTDef.type = 'map';

    } else {
      extTDef.type = intTDef.type;
      if (intTDef.hasOwnProperty(intTDef.type)) {
        extTDef[intTDef.type] = this.mapInt2ExtTypeDef(intTDef[intTDef.type]);
      }
    }
    return extTDef;
  }

  public setType(portType: string) {
    this.intTypeDef.type = portType;
    switch (portType) {
      case 'map':
        this.intTypeDef[portType] = [{name: 'port', def: TypeDefFormComponent.newPrimitiveTypeDef()}];
        break;
      case 'generic':
        this.intTypeDef[portType] = 'itemType';
        break;
      default:
        this.intTypeDef[portType] = TypeDefFormComponent.newPrimitiveTypeDef();
    }
    this.handleTypeDefChanged();
  }

  public getMapPortNames2(tDef: any): Array<string> {
    if (OperatorDef.isMap(tDef)) {
      return Array.from(Object.keys(tDef.map)).filter(k => tDef.map.hasOwnProperty(k));
    }
    return [];
  }

  public getMapPortNames(): Array<string> {
    if (this.isMap()) {
      return this.intTypeDef.map.map(curr => curr.name);
    }
    return [];
  }

  public getMapEntry(portName): any | null {
    return this.intTypeDef.map.find(curr => curr.name === portName);
  }

  public getMapEntryIndex(portName): number {
    return this.intTypeDef.map.findIndex(curr => curr.name === portName);
  }

  public addMapPort(portName: string) {
    const existingMapEntry = this.getMapEntry(portName);
    if (!portName || existingMapEntry) {
      return;
    }
    this.intTypeDef.map.push({name: portName, def: TypeDefFormComponent.newPrimitiveTypeDef()});
    this.resetNewMapPortName();
    this.handleTypeDefChanged();
  }

  public renameMapPortName(oldPortName, newPortName: string) {
    const collidingMapEntry = this.getMapEntry(newPortName);
    if (collidingMapEntry) {
      return;
    }

    const existingMapEntry = this.getMapEntry(oldPortName);
    if (!existingMapEntry) {
      return;
    }
    existingMapEntry.name = newPortName;
    this.handleTypeDefChanged();
  }

  public removeMapPort(portName: string) {
    const existingMapEntry = this.getMapEntryIndex(portName);
    if (!existingMapEntry) {
      return;
    }

    const idx = this.getMapEntryIndex(portName);
    if (idx > -1) {
      delete this.intTypeDef.map[idx];
    }
    this.handleTypeDefChanged();
  }

  public handleTypeDefChanged() {
    this.mapInt2ExtTypeDef(this.intTypeDef, this.port);
    this.typeDefChanged.emit(null);
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
