import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OperatorService} from '../services/operator.service';
import {OperatorDef} from '../classes/operator-def.class';
import {safeDump, safeLoad} from 'js-yaml';
import {generateSvgTransform} from '../utils';

@Component({
  templateUrl: './operator.component.html',
  styleUrls: []
})
export class OperatorComponent implements OnInit {
  // General
  public operatorName = '';
  public operator: OperatorDef = null;
  public status;

  // YAML
  public yamlRepr = '';

  // Visual
  public visualInsts = new Map<string, OperatorInstance>();
  public visualSelectedInst: OperatorInstance = null;

  // Dragging
  private dragging = false;
  private lastX: number;
  private lastY: number;

  constructor(private route: ActivatedRoute, public operators: OperatorService) {
  }

  ngOnInit() {
    this.route.params.subscribe(routeParams => {
      this.operatorName = routeParams.operatorName;
      this.operator = this.operators.getLocal(routeParams.operatorName);
      if (this.operator) {
        this.updateDef(this.operator.getDef());
      } else {
        this.status = `Operator "${this.operatorName}" not found.`;
      }
    });
    this.operators.getLoadingObservable().subscribe((success) => {
      if (success) {
        this.operator = this.operators.getLocal(this.operatorName);
        if (this.operator) {
          this.updateDef(this.operator.getDef());
        } else {
          this.status = `Operator "${this.operatorName}" not found.`;
        }
      }
    });
  }

  // YAML

  public updateYaml(newYaml) {
    this.yamlRepr = newYaml;
  }

  public storeYaml() {
    try {
      const newDef = safeLoad(this.yamlRepr);
      this.updateDef(newDef);
      this.status = 'Parsed YAML successfully.';
    } catch (e) {
      this.status = e.toString();
    }
  }

  private updateDef(def: any) {
    this.operator.setDef(def);
    this.status = `Updated definition of operator "${this.operatorName}".`;
    this.displayYaml();
    this.displayVisual();
  }

  private displayYaml() {
    this.yamlRepr = safeDump(this.operator.getDef());
  }

  // Visual

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public visualInstances() {
    return Array.from(this.visualInsts.values()).filter(ins => ins.isVisible());
  }

  public selectVisualInstance(ins: OperatorInstance) {
    this.visualSelectedInst = ins;
    /*

    for (const insName in this.visualInsts) {
      if (this.visualInsts.hasOwnProperty(insName)) {
        this.visualInsts[insName].selected = false;
      }
    }
    ins.selected = true;
    this.visualSelectedInst = ins;
    */
  }

  private displayVisual() {
    const def = this.operator.getDef();
    this.visualInsts.forEach(ins => ins.hide());
    for (const insName in def.operators) {
      if (def.operators.hasOwnProperty(insName)) {
        const ins = def.operators[insName];
        let opName = ins.operator;
        if (opName.startsWith('.')) {
          const opSplit = this.operatorName.split('.');
          opSplit[opSplit.length - 1] = opName.substr(1);
          opName = opSplit.join('.');
        }
        const op = this.operators.getOperator(opName);
        let visualIns = this.visualInsts.get(insName);
        if (typeof visualIns === 'undefined') {
          const opDef = JSON.parse(JSON.stringify(op.getDef()));
          OperatorDef.specifyOperatorDef(opDef, ins['generics'], ins['properties'], opDef['properties']);
          visualIns = new OperatorInstance(insName, null, [Math.random() * 600, Math.random() * 400], [1, 1], 0, opDef);
          this.visualInsts.set(insName, visualIns);
        }
        visualIns.show();
      }
    }
  }

  public addInstance(op: any) {
    const def = this.operator.getDef();
    const opSplit = op.name.split('.');
    const opName = opSplit[opSplit.length - 1];
    let insName = opName;
    let i = 1;
    if (!def.operators) {
      def.operators = {};
    }
    while (def.operators[insName]) {
      insName = opName + i;
      i++;
    }
    def.operators[insName] = {
      operator: op.name
    };
    this.updateDef(def);
  }

  // Dragging

  private updateDrag(event, update?: boolean) {
    if (this.visualSelectedInst && update) {
      this.visualSelectedInst.move([event.screenX - this.lastX, event.screenY - this.lastY]);
    }
    this.lastX = event.screenX;
    this.lastY = event.screenY;
  }

  public startDrag(event: any) {
    this.dragging = true;
    this.updateDrag(event);
  }

  public stopDrag(event: any) {
    this.dragging = false;
    this.updateDrag(event, true);
  }

  public drag(event: any) {
    if (event.buttons === 0) {
      this.dragging = false;
    }
    if (this.dragging) {
      this.updateDrag(event, true);
    }
  }

}

export class Transformable {
  protected dim: [number, number];

  constructor(protected pos: [number, number], private scale: [number, number], private rotation: number) {
  }

  public getPosX(): number {
    return this.pos[0];
  }

  public getPosY(): number {
    return this.pos[1];
  }

  public getScaleX(): number {
    return this.scale[0];
  }

  public getScaleY(): number {
    return this.scale[1];
  }

  public getRotation(): number {
    return this.rotation;
  }

  public getWidth(): number {
    return this.dim[0];
  }

  public getHeight(): number {
    return this.dim[1];
  }
}

interface Movable {
  move(delta: [number, number]): [number, number];
}

class Composable extends Transformable {
  constructor(private parent: Composable, pos: [number, number], scale: [number, number], rotation: number) {
    super(pos, scale, rotation);
  }

  public getParent(): Composable {
    return this.parent;
  }

  public getAbsX(): number {
    if (!this.parent) {
      return this.getPosX();
    }
    return this.parent.getAbsX() + this.getPosX();
  }

  public getAbsY(): number {
    if (!this.parent) {
      return this.getPosY();
    }
    return this.parent.getAbsY() + this.getPosY();
  }

}

class OperatorInstance extends Composable implements Movable {
  private mainIn: Port;
  private mainOut: Port;
  private services: Map<string, PortGroup>;
  private delegates: Map<string, PortGroup>;
  private visible: boolean;

  constructor(private name: string, parent: Composable, pos: [number, number], scale: [number, number], rotation: number, opDef: any) {
    super(parent, pos, scale, rotation);
    this.mainIn = new Port(this, [0, 0], [1, 1], 0, opDef.services['main']['in']);
    const tmpMainOut = new Port(this, [0, 0], [1, 1], 0, opDef.services['main']['out']);
    const width = Math.max(Math.max(this.mainIn.getWidth(), tmpMainOut.getWidth()) + 10, 130);
    let height = this.mainIn.getHeight() + 10;

    this.delegates = new Map<string, PortGroup>();

    if (opDef.delegates) {
      for (const dlgName in opDef.delegates) {
        if (opDef.delegates.hasOwnProperty(dlgName)) {
          const dlgDef = opDef.delegates[dlgName];
          const dlg = new PortGroup(this, [width, height], [1, 1], 90, dlgDef);
          this.delegates.set(dlgName, dlg);
          height += dlg.getWidth() + 5;
        }
      }
    }
    height = Math.max(height + 10, 60);
    this.mainOut = new Port(this, [0, height], [1, -1], 0, opDef.services['main']['out']);
    this.dim = [width, height];
  }

  public move(delta: [number, number]): [number, number] {
    this.pos[0] += delta[0];
    this.pos[1] += delta[1];
    return this.pos;
  }

  public getMainIn(): Port {
    return this.mainIn;
  }

  public getMainOut(): Port {
    return this.mainOut;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public show() {
    this.visible = true;
  }

  public hide() {
    this.visible = false;
  }

  public getName(): string {
    return this.name;
  }

  public getDelegates(): Array<PortGroup> {
    return Array.from(this.delegates.values());
  }
}

class PortGroup extends Composable {
  private in: Port;
  private out: Port;

  constructor(parent: Composable, pos: [number, number], scale: [number, number], rotation: number, portGrpDef: any) {
    super(parent, pos, scale, rotation);
    this.in = new Port(this, [0, 0], [1, 1], 0, portGrpDef.in);
    this.out = new Port(this, [this.in.getWidth() + 5, 0], [1, 1], 0, portGrpDef.out);
    this.dim = [this.in.getWidth() + this.out.getWidth() + 10, Math.max(this.in.getHeight(), this.out.getHeight())];
  }

  public getIn(): Port {
    return this.in;
  }

  public getOut(): Port {
    return this.out;
  }
}

export class Port extends Composable {
  private type: string;
  private generic: string;
  private stream: Port;
  private map: Map<string, Port>;

  constructor(parent: Composable, pos: [number, number], scale: [number, number], rotation: number, portDef: any) {
    super(parent, pos, scale, rotation);
    this.type = portDef.type;
    this.dim = [20, 10];


    switch (this.type) {
      case 'generic':
        this.generic = portDef.generic;
        break;
      case 'stream':
        this.stream = new Port(this, [5, 0], [1, 1], 0, portDef.stream);
        this.dim = [this.stream.getWidth() + 10, this.stream.getHeight() + 5];
        break;
      case 'map':
        let x = 0;
        let height = 0;
        this.map = new Map<string, Port>();
        for (const k in portDef.map) {
          if (portDef.map.hasOwnProperty(k)) {
            const p = new Port(this, [x, 0], [1, 1], 0, portDef.map[k]);
            this.map.set(k, p);
            x += p.getWidth() + 5;
            height = Math.max(height, p.getHeight());
          }
        }
        this.dim = [x, height];
        break;
    }
  }

  public isPrimitive(): boolean {
    return this.type === 'number' ||
      this.type === 'string' ||
      this.type === 'binary' ||
      this.type === 'boolean' ||
      this.type === 'primitive' ||
      this.type === 'trigger';
  }

  public isGeneric(): boolean {
    return this.type === 'generic';
  }

  public isStream(): boolean {
    return this.type === 'stream';
  }

  public isMap(): boolean {
    return this.type === 'map';
  }

  public getMap(): Map<string, Port> {
    return this.map;
  }

  public getStream(): Port {
    return this.stream;
  }

}
