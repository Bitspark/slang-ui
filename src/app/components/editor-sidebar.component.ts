import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';

import {BroadcastService} from '../services/broadcast.service';

import {TypeDefFormComponent} from './type-def-form.component';

import {Identifiable, Identity, OperatorDef, OperatorInstance} from '../classes/operator';
import {createDefaultValue} from '../utils';

@Component({
  selector: 'app-editor-sidebar',
  templateUrl: './editor-sidebar.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorSidebarComponent implements OnInit, OnDestroy {

  // SURROUNDING INSTANCE

  public surrounding_: OperatorInstance;

  @Input()
  public set surrounding(ins: OperatorInstance) {
    this.surrounding_ = ins;
  }

  public get surrounding(): OperatorInstance {
    return this.surrounding_;
  }

  public definition_: OperatorDef;

  // OPERATOR DEFINITION

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
        this.mainPropertyDefs = opDef.properties;
      }
    }
  }

  public get definition(): OperatorDef {
    return this.definition_;
  }

  // CHANGE EMITTER

  @Output()
  public definitionChange = new EventEmitter<void>();

  // GENERAL
  // Fields needed by both main and child instances

  private callback: (Identifiable) => void;

  // MAIN INSTANCE
  // Fields needed by main instance, should be prefixed 'main'

  public mainSrvPort: any;
  public mainPropertyDefs: any;
  public mainNewPropName: string;

  // CHILD INSTANCE
  // Fields needed by child instances, should be prefixed 'ins'

  public insGenericNames: Array<string> = [];
  public insGenericSpecs: { [key: string]: any } = {};
  public insPropertyDefs: Array<{ name: string, def: any }> = [];
  public insPropertyValues: { [key: string]: any } = {};

  // This is necessary because we can specify the type and the value in this very same component
  // TypeValue components subscribe to this identity and TypeDef components broadcast to it
  public insEditorSidebarIdentity = new Identity('editor-sidebar');

  constructor(private ref: ChangeDetectorRef, public broadcast: BroadcastService) {
    ref.detach();
  }

  public ngOnInit() {
    this.callback = this.broadcast.subscribeSelect((ins: Identifiable) => {
      if (!(ins instanceof OperatorInstance)) {
        return;
      }
      this.insGenericNames = [];
      this.insGenericSpecs = {};
      this.insPropertyDefs = [];
      this.insPropertyValues = undefined;
      if (this.surrounding !== ins) {
        this.insUpdateGenerics(ins);
        this.insUpdatePropertyDefs(ins);
        this.insUpdatePropertyValues(ins);
      }
      this.ref.detectChanges();
    });
  }

  public ngOnDestroy() {
    this.broadcast.unsubscribeSelect(this.callback);
  }

  public isAnyEntitySelected(): boolean {
    return !!this.broadcast.getSelected();
  }

  public isInstanceSelected(): boolean {
    return this.isAnyEntitySelected() && this.broadcast.getSelected() !== this.surrounding &&
      this.broadcast.getSelected() instanceof OperatorInstance;
  }

  public isSurroundingSelected(): boolean {
    return this.isAnyEntitySelected() && this.broadcast.getSelected() === this.surrounding;
  }

  public getSelectedInstance(): OperatorInstance {
    const selected = this.broadcast.getSelected();
    if (!(selected instanceof OperatorInstance)) {
      return null;
    }
    return selected;
  }

  // MAIN INSTANCE

  public insLastName(): string {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      return ins.lastName();
    }
    return '';
  }

  public mainPropertyNames(): Array<string> {
    const names = [];
    for (const propName in this.mainPropertyDefs) {
      if (this.mainPropertyDefs.hasOwnProperty(propName)) {
        names.push(propName);
      }
    }
    return names;
  }

  public mainRemoveProperty(propName: string) {
    delete this.mainPropertyDefs[propName];
    this.definitionChange.emit();
    this.ref.detectChanges();
  }

  public mainAddProperty() {
    const propName = this.mainNewPropName;
    if (this.mainPropertyDefs[propName]) {
      return;
    }
    this.mainPropertyDefs[propName] = TypeDefFormComponent.newDefaultTypeDef('primitive');
    this.mainNewPropName = '';
    this.definitionChange.emit();
    this.ref.detectChanges();
  }

  public mainNewPropNameChange() {
    this.ref.detectChanges();
  }

  public mainPropertyNameValid(): boolean {
    return !!this.mainNewPropName && !this.mainPropertyDefs[this.mainNewPropName];
  }

  public mainServiceChanged(): void {
    this.definitionChange.emit();
  }

  public mainPropertyChanged(): void {
    this.definitionChange.emit();
  }

  // CHILD INSTANCES

  public insSpecifyGeneric(genName: string) {
    const ins = this.getSelectedInstance();
    const oDef = this.definition.getDef();
    const insDef = oDef.operators[ins.getName()];
    if (!insDef.generics) {
      insDef.generics = {};
    }
    this.insGenericSpecs = insDef.generics;
    this.insGenericSpecs[genName] = TypeDefFormComponent.newDefaultTypeDef('primitive');
    this.insUpdatePropertyDefs(ins);
    this.definitionChange.emit();
    this.ref.detectChanges();
  }

  public insSpecifyProperty(prop: { name: string, def: any }): any {
    if (!this.insPropertyValues) {
      const ins = this.getSelectedInstance();
      const oDef = this.definition.getDef();
      const insDef = oDef.operators[ins.getName()];
      if (!insDef.properties) {
        this.insPropertyValues = insDef.properties = {};
      } else {
        this.insPropertyValues = insDef.properties;
      }
    }
    this.insPropertyValues[prop.name] = createDefaultValue(prop.def);
    this.definitionChange.emit();
    this.ref.detectChanges();
  }

  public insUpdateGenerics(ins: OperatorInstance): any {
    this.insGenericNames = Array.from(ins.getGenericNames());
    this.insGenericSpecs = {};
    const oDef = this.definition.getDef();
    const insDef = oDef.operators[ins.getName()];
    if (!insDef) {
      return;
    }
    const insGenSpecs = insDef.generics;
    if (!insGenSpecs) {
      return;
    }
    this.insGenericSpecs = insGenSpecs;
  }

  private insUpdatePropertyValues(ins: OperatorInstance): void {
    const oDef = this.definition.getDef();
    const insDef = oDef.operators[ins.getName()];
    if (!insDef) {
      return;
    }
    if (insDef.properties) {
      this.insPropertyValues = insDef.properties;
    }
  }

  private insUpdatePropertyDefs(ins: OperatorInstance): void {
    if (this.insPropertyDefs.length === 0) {
      this.insPropertyDefs = Array.from(ins.getPropertyDefs().entries()).map(each => {
        const defCopy = JSON.parse(JSON.stringify(each[1]));
        OperatorDef.specifyTypeDef(defCopy, this.insGenericSpecs, {}, {});
        return {name: each[0], def: defCopy};
      });
    } else {
      Array.from(ins.getPropertyDefs().entries()).forEach(each => {
        const defCopy = JSON.parse(JSON.stringify(each[1]));
        OperatorDef.specifyTypeDef(defCopy, this.insGenericSpecs, {}, {});

        const propName = each[0];

        // Find entry
        for (const prop of this.insPropertyDefs) {
          if (prop.name !== propName) {
            continue;
          }
          Object.assign(prop.def, defCopy);
        }
      });
    }
  }

  public insTypeSpecified(propDef: any): boolean {
    if (!propDef) {
      return false;
    }

    if (propDef.type === 'stream') {
      return this.insTypeSpecified(propDef.stream);
    }

    if (propDef.type === 'map') {
      for (const sub in propDef.map) {
        if (!propDef.map.hasOwnProperty(sub)) {
          continue;
        }
        if (!this.insTypeSpecified(propDef.map[sub])) {
          return false;
        }
      }
      return true;
    }

    if (propDef.type !== 'generic') {
      // Primitives are always specified
      return true;
    }

    return !!this.insGenericSpecs[propDef.generic];
  }

  public insPropertyValueSpecified(prop: { name: string, def: any }): boolean {
    return this.insPropertyValues && typeof this.insPropertyValues[prop.name] !== 'undefined';
  }

  public insGenericSpecified(genName: string): boolean {
    return !!this.insGenericSpecs[genName];
  }

  public insGenericTypeChanged(): void {
    this.insUpdatePropertyDefs(this.getSelectedInstance());

    this.definitionChange.emit();
    this.broadcast.update(this.insEditorSidebarIdentity);
    this.broadcast.update(this.getSelectedInstance());
  }

  public insPropertyValueChanged(): void {
    this.definitionChange.emit();
    this.broadcast.update(this.getSelectedInstance());
  }

  public insRotateRight() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.rotate(Math.PI / 2);
      this.updateInstance(ins);
    }
  }

  public insRotateLeft() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.rotate(-Math.PI / 2);
      this.updateInstance(ins);
    }
  }

  public insMirrorVertically() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.scale([1, -1]);
      this.updateInstance(ins);
    }
  }

  public insMirrorHorizontally() {
    const ins = this.getSelectedInstance();
    if (!!ins) {
      ins.scale([-1, 1]);
      this.updateInstance(ins);
    }
  }

  // GENERAL

  // TODO: Move this logic!
  private updateInstance(ins: OperatorInstance) {
    this.broadcast.update(ins);
    // Also update connections
    this.surrounding.getConnections().forEach(conn => {
      if (conn.getSource().getOperator() === ins || conn.getDestination().getOperator() === ins) {
        this.broadcast.update(conn);
      }
    });
  }

}
