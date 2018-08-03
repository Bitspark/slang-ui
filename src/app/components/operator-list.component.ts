import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {OperatorDef} from '../classes/operator';
import {compareOperatorDefs} from '../utils';

@Component({
  selector: 'app-operator-list',
  templateUrl: './operator-list.component.html',
  styleUrls: ['./operator-list.component.scss']
})
export class OperatorListComponent implements OnInit {
  @Input()
  private operatorList: Array<OperatorDef> = [];
  @Input()
  public buttonIcon = '';
  @Output()
  public operatorSelected = new EventEmitter();

  public filterString = '';

  constructor() {
  }

  ngOnInit() {
  }

  public emitOperatorSelected(op: OperatorDef) {
    this.operatorSelected.emit(op);
  }

  public localOperatorList(): Array<OperatorDef> {
    return this.filteredOperatorList()
      .filter(op => op.isLocal())
      .sort(compareOperatorDefs);
  }

  public globalOperatorList(): Array<OperatorDef> {
    return this.filteredOperatorList()
      .filter(op => op.isLocal())
      .sort(compareOperatorDefs);
  }

  public filteredOperatorList(): Array<OperatorDef> {
    return Array
      .from(this.operatorList.values())
      .filter(op => op.getName().toLowerCase().indexOf(this.filterString.toLowerCase()) !== -1)
      .sort(compareOperatorDefs);
  }

}
