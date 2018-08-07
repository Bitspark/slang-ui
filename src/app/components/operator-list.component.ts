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
  private operatorList: Array<OperatorDef>;
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

  public localOperatorList(): Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> {
    return this.filteredOperatorList()
      .filter(op => op.isLocal())
      .sort(compareOperatorDefs)
      .map(opDef => {
        return {
          newGroup: false,
          name: opDef.getName(),
          opDef: opDef,
        };
      });
  }

  public globalOperatorList(): Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> {
    const opList: Array<OperatorDef> = this.filteredOperatorList()
      .filter(opDef => opDef.isGlobal())
      .sort(compareOperatorDefs);

    let grpName = '';
    const listItems: Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> = [];
    for (const opDef of opList) {
      // "slang", "...", "..."
      let isNewGrp = false;
      const splitName = opDef.getName().split('.').filter(n => n !== 'slang');

      if (splitName.length > 1) {
        const newGrp = splitName[0];
        if (isNewGrp = newGrp !== grpName) {
          grpName = newGrp;
        }
      }

      if (isNewGrp) {
        listItems.push({
          newGroup: true,
          name: grpName,
          opDef: null,
        });
      }
      listItems.push({
        newGroup: false,
        name: splitName[splitName.length - 1],
        opDef: opDef,
      });
    }
    return listItems;
  }

  public hasGlobals(): boolean {
    return this.operatorList.find(op => op.isGlobal()) !== undefined;
  }

  public filteredOperatorList(): Array<OperatorDef> {
    return this.operatorList
      .filter(opDef => opDef.getName().toLowerCase().indexOf(this.filterString.toLowerCase()) !== -1);
  }
}
