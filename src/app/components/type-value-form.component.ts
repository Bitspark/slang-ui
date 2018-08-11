import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {createDefaultValue} from '../utils';

@Component({
  selector: 'app-type-value-form',
  templateUrl: './type-value-form.component.html',
  styleUrls: ['./type-value-form.component.scss']
})
export class TypeValueFormComponent implements OnInit, OnChanges {

  private specialTypes = {
    'file': {
      type: 'map',
      map: {
        'file': {
          type: 'binary'
        },
        'name': {
          type: 'string'
        }
      }
    },
    'image': {
      type: 'map',
      map: {
        'image': {
          type: 'binary'
        },
        'name': {
          type: 'string'
        }
      }
    }
  };

  constructor() {
  }

  // TYPE DEF
  private typeDef_: any;

  get typeDef() {
    return this.typeDef_;
  }

  @Input()
  set typeDef(val) {
    this.typeDef_ = val;
  }

  // TYPE VALUE
  private typeVal_: any;

  @Output()
  public typeValueChange = new EventEmitter();

  @Input()
  get typeValue() {
    return this.typeVal_;
  }

  set typeValue(val) {
    this.typeVal_ = val;
    this.emitChange();
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges): void {
  }

  public emitChange() {
    this.typeValueChange.emit(this.typeVal_);
  }

  public getEntries(): Array<string> {
    const entries = [];
    if (this.typeDef.type === 'map') {
      for (const key in this.typeDef.map) {
        if (this.typeDef.map.hasOwnProperty(key)) {
          entries.push(key);
        }
      }
    } else {
      for (let i = 0; i < this.typeValue.length; i++) {
        entries.push(i);
      }
    }
    return entries;
  }

  public add(): void {
    const ne = createDefaultValue(this.typeDef.stream);
    this.typeValue.push(ne);
  }

  public setIndex(i: number, val: any) {
    this.typeValue[i] = val;
  }

  public removeIndex(i: number) {
    this.typeValue.splice(i, 1);
  }

  public selectFile(event) {
    const special = this.specialType();

    const file = event.srcElement.files[0];
    const reader = new FileReader();
    const that = this;
    reader.onload = function() {
      const data = reader.result;
      const base64 = data.substr(data.indexOf(',') + 1);
      if (!special) {
        that.typeValue = 'base64:' + base64;
      } else {
        switch (special) {
          case 'file':
            that.typeValue.name = file.name;
            that.typeValue.file = 'base64:' + base64;
            break;
          case 'image':
            that.typeValue.name = file.name;
            that.typeValue.image = 'base64:' + base64;
            break;
        }
      }
    };
    reader.readAsDataURL(file);
  }

  public mapContains(def: any, test: any): boolean {
    if (typeof def !== 'object' || typeof test !== 'object') {
      return def === test;
    }
    for (const entry in def) {
      if (def.hasOwnProperty(entry)) {
        if (!test[entry]) {
          return false;
        }
        if (!this.mapContains(def[entry], test[entry])) {
          return false;
        }
      }
    }
    return true;
  }

  public hasType(def: any, test: any): boolean {
    return this.mapContains(def, test) && this.mapContains(test, def);
  }

  public specialType(): string {
    for (const spec in this.specialTypes) {
      if (this.specialTypes.hasOwnProperty(spec)) {
        const specType = this.specialTypes[spec];
        if (this.hasType(this.typeDef, specType)) {
          return spec;
        }
      }
    }
    return undefined;
  }

}
