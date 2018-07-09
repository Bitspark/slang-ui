import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {createDefaultValue} from '../utils';

@Component({
  selector: 'app-type-value-form',
  templateUrl: './type-value-form.component.html',
  styleUrls: ['./type-value-form.component.scss']
})
export class TypeValueFormComponent implements OnInit, OnChanges {

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
    const file = event.srcElement.files[0];
    const reader = new FileReader();
    const that = this;
    reader.onload = function() {
      const data = reader.result;
      const base64 = data.substr(data.indexOf(',') + 1);
      that.typeValue = 'base64:' + base64;
    };
    reader.readAsDataURL(file);
  }

}
