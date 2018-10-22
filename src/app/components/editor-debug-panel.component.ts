import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {createDefaultValue, HTTP_REQUEST_DEF, HTTP_RESPONSE_DEF} from '../utils';
import {OperatorDef, OperatorInstance} from '../classes/operator';
import * as deepEqual from 'deep-equal';
import {HttpClient} from '@angular/common/http';
import {TypeDefFormComponent} from './type-def-form.component';
import {ApiService} from '../services/api.service';

@Component({
  selector: 'app-editor-debug-panel',
  templateUrl: './editor-debug-panel.component.html',
  styleUrls: ['./editor-debug-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorDebugPanelComponent implements OnInit {
  public inputValue: any = {};
  public running = false;
  public runningHandle = '';
  public debuggingLog: Array<string> = [];
  public debuggingReponses: Array<any> = [];
  public debuggingGens = {};
  public debuggingPropDefs = {};
  public debuggingInPort = {};
  public debuggingOutPort = {};
  public debuggingProps = {};
  public operatorEndpoint = '';
  public propertyDefs: any = null;
  public mainSrvPort: any = null;
  public interval: any = null;

  // DEBUG STATE

  // This is the normal cycle:
  // 'none' -> 'startDebugging' -> ['specifying'] -> 'debugging' -> 'stopOperator' -> 'startDebugging'

  public debugState_ = null;

  @Input()
  set debugState(state: string) {
    if (this.debugState_ === state) {
      return;
    }

    this.debugState_ = state;
    this.debugStateChange.emit(this.debugState_);

    if (state === 'startDebugging') {
      this.startDebugging();
    } else if (state === 'stopOperator') {
      this.stopOperator();
    }
  }

  get debugState(): string {
    return this.debugState_;
  }

  @Output()
  public debugStateChange = new EventEmitter<string>();

  // OPERATOR

  @Input()
  public operator: OperatorInstance;

  // DEFINITION

  private definition_: OperatorDef;

  @Input()
  public set definition(def: OperatorDef) {
    this.definition_ = def;
    if (!def) {
      return;
    }
    const opDef = def.getDef();
    if (!opDef) {
      return;
    }
    if (opDef.services) {
      this.mainSrvPort = opDef.services.main;
    }
    if (!opDef.properties) {
      opDef.properties = {};
    }
    this.propertyDefs = opDef.properties;
  }

  public get definition(): OperatorDef {
    return this.definition_;
  }

  // OPERATOR NAME

  @Input()
  public operatorName: string;

  constructor(private ref: ChangeDetectorRef, private http: HttpClient, private api: ApiService) {
    ref.detach();
  }

  ngOnInit(): void {
    this.ref.detectChanges();
  }

  public genericNames(ins: OperatorInstance): Array<string> {
    return Array.from(ins.getGenericNames());
  }

  public specifyGeneric(gens, name) {
    gens[name] = TypeDefFormComponent.newDefaultTypeDef('primitive');
    this.ref.detectChanges();
  }

  public specifyProperty(props, name, def) {
    props[name] = createDefaultValue(def);
    this.ref.detectChanges();
  }

  public debugLog(msg: string) {
    this.debuggingLog.push(msg);
  }

  public startDebugging() {
    this.refreshDebugVariables();
    if (this.operator.getGenericNames().size > 0 || this.operator.getPropertyDefs().size > 0) {
      this.specifyOperator();
    } else {
      this.runOperator();
    }
  }

  public refreshDebugVariables() {
    this.debuggingPropDefs = JSON.parse(JSON.stringify(this.propertyDefs));
    for (const propName in this.debuggingPropDefs) {
      if (this.debuggingPropDefs.hasOwnProperty(propName)) {
        OperatorDef.specifyTypeDef(this.debuggingPropDefs[propName], this.debuggingGens, {}, {});
        this.debuggingProps[propName] = createDefaultValue(this.debuggingPropDefs[propName]);
      }
    }

    this.refreshPropertyExpansion();
  }

  public refreshPropertyExpansion() {
    this.debuggingInPort = JSON.parse(JSON.stringify(this.mainSrvPort.in));
    OperatorDef.specifyTypeDef(this.debuggingInPort, this.debuggingGens, this.debuggingProps, this.propertyDefs);

    this.debuggingOutPort = JSON.parse(JSON.stringify(this.mainSrvPort.out));
    OperatorDef.specifyTypeDef(this.debuggingOutPort, this.debuggingGens, this.debuggingProps, this.propertyDefs);
  }

  public httpInput(): boolean {
    return deepEqual(this.mainSrvPort.in, HTTP_REQUEST_DEF);
  }

  public httpOutput(): boolean {
    return deepEqual(this.mainSrvPort.out, HTTP_RESPONSE_DEF);
  }

  public async sendInputValue(obj: any) {
    await this.api.post(this.operatorEndpoint, {}, obj);
    if (this.interval) {
      setTimeout(() => this.fetchItems(), 150);
    }
  }

  public stopOperator() {
    this.api.delete('/run/', {}, {
      handle: this.runningHandle
    }).then(data => {
        if (data['status'] === 'success') {
          this.running = false;
          this.runningHandle = '';
          this.debugLog(`Operator stopped.`);
        } else {
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
        this.debugState = 'stopped';
        this.ref.detectChanges();
      });
  }

  public specifyOperator() {
    this.debugState = 'specifying';
    this.ref.detectChanges();
  }

  private fetchItems() {
    this.api.get(this.operatorEndpoint)
      .then(responses => {
        this.debuggingReponses = responses as Array<any>;
        this.ref.detectChanges();
      })
      .catch(() => {
        clearInterval(this.interval);
        this.interval = null;
      });
  }

  public runOperator() {
    this.inputValue = createDefaultValue(this.debuggingInPort);
    this.debugLog('Request daemon to start operator...');
    this.ref.detectChanges();

    const isStream = !this.httpInput() && !this.httpOutput();

    this.api.post('/run/', {}, {
      fqn: this.operatorName,
      gens: this.debuggingGens,
      props: this.debuggingProps,
      stream: isStream
    }).then(data => {
        if (data['status'] === 'success') {
          this.debugState = 'debugging';
          this.operatorEndpoint = data['url'];
          this.debugLog('Operator is running at ' + this.operatorEndpoint);
          this.runningHandle = data['handle'];
          this.interval = null;

          if (isStream) {
            const that = this;
            this.interval = setInterval(function () {
              that.fetchItems();
            }, 2000);
          }
        } else {
          this.debugState = 'stopped';
          const error = data['error'];
          this.debugLog(`Error ${error.code} occurred: ${error.msg}`);
        }
        this.ref.detectChanges();
      });
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

  public closeDebugPanel() {
    this.debugState = null;
    this.ref.detectChanges();
  }

  public inputValueChanged() {
    this.ref.detectChanges();
  }

  public setDebuggingProp(name: string, value: any) {
    this.debuggingProps[name] = value;
    this.refreshPropertyExpansion();
  }

}
