import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {createDefaultValue} from '../utils';

@Component({
  selector: 'app-type-value-form',
  templateUrl: './type-value-form.component.html',
  styleUrls: ['./type-value-form.component.css']
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
    this.typeValueChange.emit(this.typeVal_);
  }

  ngOnInit() {
    console.log('>>> typeDef', this.typeDef_);
    console.log('>>> typeValue', this.typeVal_);
  }

  ngOnChanges(changes: SimpleChanges): void {
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

}
