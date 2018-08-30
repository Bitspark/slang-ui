import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy} from '@angular/core';
import {VisualService} from '../services/visual.service';
import {Connection, Identifiable, OperatorDef, OperatorInstance, Port} from '../classes/operator';

@Component({
  selector: 'app-editor-sidebar',
  templateUrl: './editor-sidebar.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorSidebarComponent implements OnDestroy {
  public surrounding_: OperatorInstance;

  @Input()
  public set surrounding(ins: OperatorInstance) {
    this.surrounding_ = ins;
  }

  public get surrounding(): OperatorInstance {
    return this.surrounding_;
  }

  public definition_: OperatorDef;

  @Input()
  public set definition(def: OperatorDef) {
    this.definition_ = def;
    if (!def) {
      return;
    }
    const opDef = def.getDef();
    if (opDef) {
      if (opDef.services) {
        this.mainSrvPort = opDef.services.main;
      }
      if (opDef.properties) {
        this.propertyDefs = opDef.properties;
      }
    }
  }

  public get definition(): OperatorDef {
    return this.definition_;
  }

  public mainSrvPort: any;
  public propertyDefs: any;

  private readonly callback: (Identifiable) => void;

  private insPropDefs = new Map<string, Array<{ name: string, def: any }>>();

  constructor(private ref: ChangeDetectorRef, public visual: VisualService) {
    this.callback = visual.subscribeSelect((ins: Identifiable) => {
      ref.detectChanges();
    });
  }

  public ngOnDestroy() {
    this.visual.unsubscribeSelect(this.callback);
  }

  public isAnyEntitySelected(): boolean {
    return !!this.visual.getSelected();
  }

  public isInstanceSelected(): boolean {
    return this.isAnyEntitySelected() && this.visual.getSelected() !== this.surrounding &&
      this.visual.getSelected() instanceof OperatorInstance;
  }

  public getSelectedInstance(): OperatorInstance {
    const selected = this.visual.getSelected();
    if (!(selected instanceof OperatorInstance)) {
      return null;
    }
    return selected;
  }

  public getPropertyNames(): Array<string> {
    const names = [];
    for (const propName in this.propertyDefs) {
      if (this.propertyDefs.hasOwnProperty(propName)) {
        names.push(propName);
      }
    }
    return names;
  }

  public refresh(): void {

  }

  public getGenerics(ins: OperatorInstance): any {
    const oDef = this.definition.getDef();
    return oDef.operators[ins.getName()].generics;
  }

  public genericNames(ins: OperatorInstance): Array<string> {
    return Array.from(ins.getGenericNames());
  }

  public getPropertyDefs(ins: OperatorInstance): Array<{ name: string, def: any }> {
    const def = this.insPropDefs.get(ins.getName());
    if (def) {
      return def;
    }

    const generics = this.getGenerics(ins);
    const arr = Array.from(ins.getPropertyDefs().entries()).map(each => {
      const defCopy = JSON.parse(JSON.stringify(each[1]));
      OperatorDef.specifyTypeDef(defCopy, generics, {}, {});
      return {name: each[0], def: defCopy};
    });
    this.insPropDefs.set(ins.getName(), arr);
    return arr;
  }

  public isGenericSpecified(ins: OperatorInstance, genName: string): boolean {
    const generics = this.getGenerics(ins);
    return generics && generics[genName];
  }

  public isPropertySpecified(ins: OperatorInstance, prop: { name: string, def: any }): boolean {
    const props = this.getProperties(ins);
    return props && typeof props[prop.name] !== 'undefined';
  }

  public getProperties(ins: OperatorInstance): any {
    const oDef = this.definition.getDef();
    return oDef.operators[ins.getName()].properties;
  }

  public getSelectedInstanceLastName(): string {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      return ins.lastName();
    }
    return '';
  }
}
