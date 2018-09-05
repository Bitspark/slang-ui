import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {OperatorDef} from '../classes/operator';
import {compareOperatorDefs} from '../utils';

@Component({
  selector: 'app-operator-list',
  templateUrl: './operator-list.component.html',
  styleUrls: ['./operator-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperatorListComponent implements OnInit {
  private operatorList_: Array<OperatorDef>;

  @Input()
  public set operatorList(list: Array<OperatorDef>) {
    this.operatorList_ = list;
    this.ref.detectChanges();
  }

  public get operatorList() {
    return this.operatorList_;
  }

  @Input()
  public buttonIcon = '';

  @Output()
  public operatorSelected = new EventEmitter();

  public filterString = '';

  constructor(private ref: ChangeDetectorRef) {
    ref.detach();
  }

  private static groupOperatorList(opList: Array<OperatorDef>,
                                   opName: (n: string[]) => string): Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> {
    let grpName = '';
    const listItems: Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> = [];
    for (const opDef of opList) {
      // "slang", "...", "..."
      let isNewGrp = false;
      const splitName = opDef.getName().split('.').filter(n => n !== 'slang');

      if (splitName.length > 1) {
        const newGrp = splitName.shift();
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
        name: opName(splitName),
        opDef: opDef,
      });
    }
    return listItems;
  }

  ngOnInit() {
    this.ref.detectChanges();
  }

  public hasGlobals(): boolean {
    return this.operatorList.find(op => op.isGlobal()) !== undefined;
  }

  public filteredOperatorList(): Array<OperatorDef> {
    return this.operatorList.filter(opDef => opDef.getName().toLowerCase().indexOf(this.filterString.toLowerCase()) !== -1);
  }

  public emitOperatorSelected(op: OperatorDef) {
    this.operatorSelected.emit(op);
  }

  public localOperatorList(): Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> {
    return OperatorListComponent.groupOperatorList(
      this.filteredOperatorList()
        .filter(op => op.isLocal())
        .sort(compareOperatorDefs),
      (opNameList: string[]) => opNameList.join('.'));
  }

  public globalOperatorList(): Array<{ newGroup: boolean, name: string, opDef: OperatorDef }> {
    return OperatorListComponent.groupOperatorList(
      this.filteredOperatorList()
        .filter(opDef => opDef.isGlobal())
        .sort(compareOperatorDefs),
      (opNameList: string[]) => opNameList[opNameList.length - 1]
    );
  }

  public filterStringChanged(filterString: string) {
    this.filterString = filterString;
    this.ref.detectChanges();
  }

}

