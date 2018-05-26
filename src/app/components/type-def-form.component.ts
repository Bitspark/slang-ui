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
  public subs: Array<{ name: string, def: any }> = [];
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
    this.mapToSubs();
  }

  public mapToSubs(): any {
    this.subs = [];
    if (OperatorDef.isMap(this.port)) {
      this.subs = Object.keys(this.port.map).map(portName => {
        return {name: portName, def: this.port.map[portName]};
      });
    }
  }

  public subsToMap(): any {
    if (OperatorDef.isMap(this.port)) {
      this.port.map = {};
      this.subs.forEach(curr => {
        this.port.map[curr.name] = curr.def;
      });
    }
  }

  public setType(portType: string) {
    for (const k in this.port) {
      if (k !== 'type' && this.port.hasOwnProperty(k)) {
        delete this.port[k];
      }
    }
    switch (portType) {
      case 'map':
        this.subs = [{name: 'port', def: TypeDefFormComponent.newPrimitiveTypeDef()}];
        break;
      case 'stream':
        this.port[portType] = TypeDefFormComponent.newPrimitiveTypeDef();
        break;
      case 'generic':
        this.port[portType] = 'itemType';
        break;
    }
    this.handleTypeDefChanged();
  }

  private getSubPort(portName): any | null {
    return this.subs.find(curr => curr.name === portName);
  }

  private getMapEntryIndex(portName): number {
    return this.subs.findIndex(curr => curr.name === portName);
  }

  public addMapPort(portName: string) {
    const existingMapEntry = this.getSubPort(portName);
    if (!portName || existingMapEntry) {
      return;
    }
    this.subs.push({name: portName, def: TypeDefFormComponent.newPrimitiveTypeDef()});
    this.resetNewMapPortName();
    this.handleTypeDefChanged();
  }

  public renameMapPortName(oldPortName, newPortName: string) {
    if (!newPortName) {
      return;
    }
    const collidingMapEntry = this.getSubPort(newPortName);
    if (collidingMapEntry) {
      return;
    }
    const existingMapEntry = this.getSubPort(oldPortName);
    if (!existingMapEntry) {
      return;
    }
    existingMapEntry.name = newPortName;
    this.handleTypeDefChanged();
  }

  public removeMapPort(portName: string) {
    const idx = this.getMapEntryIndex(portName);
    if (idx > -1) {
      delete this.subs[idx];
    }
    this.handleTypeDefChanged();
  }

  public handleTypeDefChanged() {
    this.subsToMap();
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
