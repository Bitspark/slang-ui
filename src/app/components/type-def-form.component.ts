import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {OperatorDef, Type} from '../classes/operator';

@Component({
  selector: 'app-type-def-form',
  templateUrl: './type-def-form.component.html',
  styleUrls: ['./type-def-form.component.scss']
})
export class TypeDefFormComponent implements OnInit {
  public typeDef_: any = TypeDefFormComponent.newDefaultTypeDef('primitive');

  @Input()
  get typeDef() {
    return this.typeDef_;
  }

  @Output() typeDefChange: EventEmitter<any> = new EventEmitter();

  set typeDef(val) {
    this.typeDef_ = val;
    this.mapToSubs();
    this.typeDefChange.emit(this.typeDef_);
  }

  public subs: Array<{ name: string, def: any }> = [];
  public types = Object.keys(Type).filter(t => typeof Type[t] === 'number');
  public newMapPortName = '';
  public newMapPortType = 'primitive';

  constructor() {
  }

  public static newDefaultTypeDef(type: string): any {
    switch (type) {
      case 'primitive':
      case 'string':
      case 'binary':
      case 'number':
      case 'boolean':
      case 'trigger':
        return {
          type: type
        };
      case 'generic':
        return {
          type: type,
          generic: 'itemType'
        };
      case 'stream':
        return {
          type: type,
          stream: {
            type: 'primitive'
          }
        };
      case 'map':
        return {
          type: type,
          map: {
            defaultEntry: {
              type: 'primitive'
            }
          }
        };
    }
  }

  ngOnInit() {
    this.mapToSubs();
  }

  public mapToSubs(): any {
    this.subs = [];
    if (OperatorDef.isMap(this.typeDef)) {
      this.subs = Object.keys(this.typeDef.map).map(portName => {
        return {name: portName, def: this.typeDef.map[portName]};
      });
    }
  }

  public subsToMap(): any {
    if (OperatorDef.isMap(this.typeDef)) {
      this.typeDef.map = {};
      this.subs.forEach(curr => {
        this.typeDef.map[curr.name] = curr.def;
      });
    }
  }

  public setType(tp: string) {
    for (const k in this.typeDef) {
      if (k !== 'type' && this.typeDef.hasOwnProperty(k)) {
        delete this.typeDef[k];
      }
    }
    switch (tp) {
      case 'map':
        this.subs = [{name: 'entryName', def: TypeDefFormComponent.newDefaultTypeDef('primitive')}];
        break;
      case 'stream':
        this.typeDef[tp] = TypeDefFormComponent.newDefaultTypeDef('primitive');
        break;
      case 'generic':
        this.typeDef[tp] = 'itemType';
        break;
    }
    this.handleTypeDefChanged();
  }

  private getSub(name: string): any | null {
    return this.subs.find(curr => curr.name === name);
  }

  private getMapEntryIndex(name: string): number {
    return this.subs.findIndex(curr => curr.name === name);
  }

  public addSub(name: string, type: string) {
    if (!this.validPortName(name)) {
      return;
    }
    this.subs.push({name: name, def: TypeDefFormComponent.newDefaultTypeDef(type)});
    this.resetNewMapPortName();
    this.handleTypeDefChanged();
  }

  public renameSubName(oldName, newName: string) {
    if (!newName) {
      return;
    }
    const collidingMapEntry = this.getSub(newName);
    if (collidingMapEntry) {
      return;
    }
    const existingMapEntry = this.getSub(oldName);
    if (!existingMapEntry) {
      return;
    }
    existingMapEntry.name = newName;
    this.handleTypeDefChanged();
  }

  public renameGenericName(newName: string) {
    this.handleTypeDefChanged();
  }

  public removeMapPort(name: string) {
    const idx = this.getMapEntryIndex(name);
    if (idx > -1) {
      this.subs.splice(idx, 1);
    }
    this.handleTypeDefChanged();
  }

  public handleTypeDefChanged() {
    this.subsToMap();
    this.typeDefChange.emit(this.typeDef_);
  }

  public resetNewMapPortName() {
    this.newMapPortName = '';
  }

  public isMap(): boolean {
    return OperatorDef.isMap(this.typeDef);
  }

  public isStream(): boolean {
    return OperatorDef.isStream(this.typeDef);
  }

  public isGeneric(): boolean {
    return OperatorDef.isGeneric(this.typeDef);
  }

  public validPortName(name: string): boolean {
    return name.length > 0 && !this.getSub(name);
  }

}
