import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges, OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {createDefaultValue} from '../utils';
import {Identifiable} from '../classes/operator';
import {BroadcastService} from '../services/broadcast.service';
import * as deepEqual from 'deep-equal';

@Component({
  selector: 'app-type-value-form',
  templateUrl: './type-value-form.component.html',
  styleUrls: ['./type-value-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TypeValueFormComponent implements OnInit, OnDestroy, OnChanges {

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

  constructor(private ref: ChangeDetectorRef, private broadcast: BroadcastService) {
    ref.detach();
  }

  // TYPE DEF
  private oldTypeDef_: any;
  private typeDef_: any;

  get typeDef() {
    return this.typeDef_;
  }

  @Input()
  set typeDef(val) {
    this.typeDef_ = val;
    if (this.typeValue) {
      this.ref.detectChanges();
    }
  }

  // TYPE VALUE
  private typeVal_: any;

  @Output()
  public typeValueChange = new EventEmitter();

  get typeValue() {
    return this.typeVal_;
  }

  @Input()
  set typeValue(val) {
    this.typeVal_ = val;
    this.ref.detectChanges();
  }

  // TYPE DEF CHANGE CALLBACK

  private callback: any;

  @Input()
  public subscribe: Identifiable;

  ngOnInit() {
    if (!!this.subscribe) {
      this.oldTypeDef_ = JSON.parse(JSON.stringify(this.typeDef));
      this.callback = this.broadcast.registerCallback(this.subscribe, () => {
        if (!deepEqual(this.typeDef, this.oldTypeDef_)) {
          this.typeValue = createDefaultValue(this.typeDef);
          this.emitChange();
        }
        this.ref.detectChanges();
        this.oldTypeDef_ = JSON.parse(JSON.stringify(this.typeDef));
      });
    }
  }

  ngOnDestroy() {
    if (!!this.subscribe) {
      this.broadcast.unregisterCallback(this.subscribe, this.callback);
    }
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
    } else if (this.typeValue) {
      for (let i = 0; i < this.typeValue.length; i++) {
        entries.push(i);
      }
    }
    return entries;
  }

  public add(): void {
    const ne = createDefaultValue(this.typeDef.stream);
    this.typeValue.push(ne);
    this.emitChange();
    this.ref.detectChanges();
  }

  public setIndex(i: number, val: any) {
    this.typeValue[i] = val;
    this.emitChange();
  }

  public removeIndex(i: number) {
    this.typeValue.splice(i, 1);
    this.emitChange();
    this.ref.detectChanges();
  }

  public selectFile(event) {
    const special = this.specialType();

    const file = event.srcElement.files[0];
    const reader = new FileReader();
    const that = this;
    reader.onload = function () {
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
