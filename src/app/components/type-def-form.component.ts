import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Identifiable, OperatorDef, Type} from '../classes/operator';
import {BroadcastService} from '../services/broadcast.service';

@Component({
  selector: 'app-type-def-form',
  templateUrl: './type-def-form.component.html',
  styleUrls: ['./type-def-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TypeDefFormComponent implements OnInit {
  public typeDef_: any = TypeDefFormComponent.newDefaultTypeDef('primitive');

  get typeDef() {
    return this.typeDef_;
  }

  @Output() typeDefChange: EventEmitter<any> = new EventEmitter();

  @Input()
  set typeDef(val) {
    this.typeDef_ = val;
    this.mapToSubs();
    this.ref.detectChanges();
  }

  @Input()
  public broadcastTo: Identifiable;

  public subs: Array<{ name: string, def: any }> = [];
  public types = Object.keys(Type).filter(t => typeof Type[t] === 'number');
  public newSubName = '';
  public newSubType = 'primitive';

  constructor(private ref: ChangeDetectorRef, private broadcast: BroadcastService) {
    ref.detach();
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
    this.typeDefChanged();
    this.ref.detectChanges();
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
    this.typeDefChanged();
    this.ref.detectChanges();
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
    this.typeDefChanged();
  }

  public renameGenericName(newName: string) {
    this.typeDefChanged();
  }

  public removeSub(name: string) {
    const idx = this.getMapEntryIndex(name);
    if (idx > -1) {
      this.subs.splice(idx, 1);
    }
    this.typeDefChanged();
    this.ref.detectChanges();
  }

  public setMapPortName(name: string) {
    this.newSubName = name;
    this.ref.detectChanges();
  }

  public typeDefChanged() {
    this.subsToMap();
    this.typeDefChange.emit(this.typeDef);
    if (!!this.broadcastTo) {
      this.broadcast.update(this.broadcastTo);
    }
  }

  public resetNewMapPortName() {
    this.newSubName = '';
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
