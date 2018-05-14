import {expandProperties} from '../utils';
import {OperatorService} from '../services/operator.service';

export class OperatorDef {

  private readonly name: string;
  private def: any;
  private readonly type: string;
  private saved: boolean;

  public static isPrimitive(portDef: any) {
    return portDef['type'] === 'number' ||
      portDef['type'] === 'string' ||
      portDef['type'] === 'binary' ||
      portDef['type'] === 'boolean' ||
      portDef['type'] === 'primitive' ||
      portDef['type'] === 'trigger';
  }

  public static specifyOperatorDef(def: any, gens: any, props: any, propDefs: any) {
    const newSrvs = {};
    for (const srvName in def['services']) {
      if (def['services'].hasOwnProperty(srvName)) {
        this.specifyTypeDef(def['services'][srvName]['in'], gens, props, propDefs);
        this.specifyTypeDef(def['services'][srvName]['out'], gens, props, propDefs);

        const expanded = expandProperties(srvName, props, propDefs);
        for (const expand of expanded) {
          newSrvs[expand] = def['services'][srvName];
        }
      }
    }
    def['services'] = newSrvs;

    const newDlgs = {};
    for (const dlgName in def['delegates']) {
      if (def['delegates'].hasOwnProperty(dlgName)) {
        this.specifyTypeDef(def['delegates'][dlgName]['in'], gens, props, propDefs);
        this.specifyTypeDef(def['delegates'][dlgName]['out'], gens, props, propDefs);

        const expanded = expandProperties(dlgName, props, propDefs);
        for (const expand of expanded) {
          newDlgs[expand] = def['delegates'][dlgName];
        }
      }
    }
    def['delegates'] = newDlgs;
  }

  public static specifyTypeDef(def: any, gens: any, props: any, propDefs: any) {
    if (def['type'] === 'generic') {
      for (const genName in gens) {
        if (gens.hasOwnProperty(genName) && genName === def['generic']) {
          const genTypeCpy = JSON.parse(JSON.stringify(gens[genName]));
          def['type'] = genTypeCpy['type'];
          if (genTypeCpy['stream']) {
            def['stream'] = genTypeCpy['stream'];
          }
          if (genTypeCpy['map']) {
            def['map'] = genTypeCpy['map'];
          }
          if (genTypeCpy['generic']) {
            def['generic'] = genTypeCpy['generic'];
          }
          break;
        }
      }
      return;
    }
    if (this.isPrimitive(def)) {
      return;
    }
    if (def['type'] === 'stream') {
      this.specifyTypeDef(def['stream'], gens, props, propDefs);
      return;
    }
    if (def['type'] === 'map') {
      const newMap = {};
      for (const key in def['map']) {
        if (def['map'].hasOwnProperty(key)) {
          const expanded = expandProperties(key, props, propDefs);
          for (const expand of expanded) {
            newMap[expand] = def['map'][key];
          }
        }
      }
      def['map'] = newMap;
      for (const key in def['map']) {
        if (def['map'].hasOwnProperty(key)) {
          this.specifyTypeDef(def['map'][key], gens, props, propDefs);
        }
      }
      return;
    }
    console.error('Unknown type', def['type']);
  }

  constructor({name, def, type, saved}: { name: string, def: any, type: string, saved: boolean }) {
    this.name = name;
    this.def = def;
    this.type = type;
    this.saved = saved;
  }

  public getName(): string {
    return this.name;
  }

  public getDef(): any {
    return this.def;
  }

  public setDef(def: any): any {
    this.def = def;
  }

  public getType(): string {
    return this.type;
  }

  public isSaved(): boolean {
    return this.saved;
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

  protected setPosX(x: number) {
    this.pos[0] = x;
  }

  protected setPosY(y: number) {
    this.pos[1] = y;
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

export class OperatorInstance extends Composable implements Movable {
  private mainIn: Port;
  private mainOut: Port;
  private services: Map<string, PortGroup>;
  private delegates: Map<string, PortGroup>;
  private instances: Map<string, OperatorInstance>;
  private visible: boolean;

  constructor(private operatorSrv: OperatorService,
              private fqOperator: string,
              private name: string,
              parent: Composable,
              pos: [number, number],
              scale: [number, number],
              rotation: number,
              def: any) {
    super(parent, pos, scale, rotation);
    this.mainIn = new Port(this, [0, 0], [1, 1], 0, def.services['main']['in']);
    const tmpMainOut = new Port(this, [0, 0], [1, 1], 0, def.services['main']['out']);
    const width = Math.max(Math.max(this.mainIn.getWidth(), tmpMainOut.getWidth()) + 10, 130);
    let height = this.mainIn.getHeight() + 10;

    this.delegates = new Map<string, PortGroup>();
    if (def.delegates) {
      for (const dlgName in def.delegates) {
        if (def.delegates.hasOwnProperty(dlgName)) {
          height += 5;
          const dlgDef = def.delegates[dlgName];
          const dlg = new PortGroup(this, [width, height], [-1, -1], -90, dlgDef, true);
          this.delegates.set(dlgName, dlg);
          height += dlg.getWidth() + 5;
        }
      }
    }
    height = Math.max(height + 10, 60);
    this.mainOut = new Port(this, [0, height], [1, -1], 0, def.services['main']['out']);
    this.dim = [width, height];

    this.mainIn.justifyHorizontally();
    this.mainOut.justifyHorizontally();

    this.instances = new Map<string, OperatorInstance>();
    this.updateInstances(def.operators);
  }

  public updateInstances(instances: any) {
    if (!instances) {
      return;
    }

    for (const insName in instances) {
      if (instances.hasOwnProperty(insName)) {
        const ins = instances[insName];
        let opName = ins.operator;
        if (opName.startsWith('.')) {
          const opSplit = this.fqOperator.split('.');
          opSplit[opSplit.length - 1] = opName.substr(1);
          opName = opSplit.join('.');
        }
        const op = this.operatorSrv.getOperator(opName);
        let visualIns = this.instances.get(insName);
        const ipos: [number, number] = [Math.random() * 600, Math.random() * 400];
        if (typeof visualIns !== 'undefined') {
          ipos[0] = visualIns.getPosX();
          ipos[1] = visualIns.getPosY();
        }
        if (!op) {
          continue;
        }
        const opDef = JSON.parse(JSON.stringify(op.getDef()));
        OperatorDef.specifyOperatorDef(opDef, ins['generics'], ins['properties'], opDef['properties']);
        visualIns = new OperatorInstance(this.operatorSrv, opName, insName, null, ipos, [1, 1], 0, opDef);
        this.instances.set(insName, visualIns);
        visualIns.show();
      }
    }
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

  public getDelegate(dlg: string): PortGroup {
    return this.delegates.get(dlg);
  }

  public getServices(): Array<PortGroup> {
    return Array.from(this.services.values());
  }

  public getService(srv: string): PortGroup {
    return this.services.get(srv);
  }

  public getInstances(): Map<string, OperatorInstance> {
    return this.instances;
  }

  public getPort(ref: string): Port {
    if (ref.length === 0) {
      return null;
    }

    let dirIn = false;
    let sep = '';
    let opIdx = 0;
    let portIdx = 0;
    if (ref.indexOf('(') !== -1) {
      dirIn = true;
      sep = '(';
      opIdx = 1;
      portIdx = 0;
    } else if (ref.indexOf(')') !== -1) {
      dirIn = false;
      sep = ')';
      opIdx = 0;
      portIdx = 1;
    } else {
      return null;
    }

    const refSplit = ref.split(sep);
    if (refSplit.length !== 2) {
      return null;
    }
    const opPart = refSplit[opIdx];
    const portPart = refSplit[portIdx];

    let o: OperatorInstance = null;
    let p: Port = null;
    if (opPart === '') {
      o = this;
      if (dirIn) {
        p = o.getMainIn();
      } else {
        p = o.getMainOut();
      }
    } else {
      if (opPart.indexOf('.') !== -1 && opPart.indexOf('@') !== -1) {
        return null;
      }
      if (opPart.indexOf('.') !== -1) {
        const opSplit = opPart.split('.');
        if (opSplit.length !== 2) {
          return null;
        }
        const opName = opSplit[0];
        const dlgName = opSplit[1];
        if (opName === '') {
          o = this;
        } else {
          o = this.instances.get(opName);
          if (!o) {
            return null;
          }
        }
        const dlg = o.getDelegate(dlgName);
        if (dlg) {
          if (dirIn) {
            p = dlg.getIn();
          } else {
            p = dlg.getOut();
          }
        } else {
          return null;
        }
      } else if (opPart.indexOf('@') !== -1) {
        const opSplit = opPart.split('@');
        if (opSplit.length !== 2) {
          return null;
        }
        const opName = opSplit[1];
        const srvName = opSplit[0];
        if (opName === '') {
          o = this;
        } else {
          o = this.instances.get(opName);
          if (!o) {
            return null;
          }
        }
        const srv = o.getService(srvName);
        if (srv) {
          if (dirIn) {
            p = srv.getIn();
          } else {
            p = srv.getOut();
          }
        } else {
          return null;
        }
      } else {
        o = this.instances.get(opPart);
        if (!o) {
          return null;
        }
        if (dirIn) {
          p = o.getMainIn();
        } else {
          p = o.getMainOut();
        }
      }
    }

    const pathSplit = portPart.split('.');
    if (pathSplit.length === 1 && pathSplit[0] === '') {
      return p;
    }

    for (let i = 0; i < pathSplit.length; i++) {
      if (pathSplit[i] === '~') {
        p = p.getStream();
        if (!p) {
          return null;
        }
        continue;
      }

      if (p.getType() !== 'map') {
        return null;
      }

      const k = pathSplit[i];
      p = p.getEntry(k);
      if (!p) {
        return null;
      }
    }

    return p;
  }
}

export class PortGroup
  extends Composable {
  private in: Port;
  private out: Port;

  constructor(parent: Composable,
              pos: [number, number],
              scale: [number, number],
              rotation: number,
              portGrpDef: any,
              reversePorts: boolean) {
    super(parent, pos, scale, rotation);
    if (reversePorts) {
      this.out = new Port(this, [0, 0], [1, 1], 0, portGrpDef.out);
      this.in = new Port(this, [this.out.getWidth() + 5, 0], [1, 1], 0, portGrpDef.in);
    } else {
      this.in = new Port(this, [0, 0], [1, 1], 0, portGrpDef.in);
      this.out = new Port(this, [this.in.getWidth() + 5, 0], [1, 1], 0, portGrpDef.out);
    }
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

  /**
   * x: width [px]
   * y: height [px]
   * p*: padding [px]
   */
  private static style = {
    x: 20,
    y: 10,

    str: {
      px: 2,
      py: 2,
    },

    map: {
      px: 2,
    }
  };

  private type: string;
  private generic: string;
  private stream: Port;
  private map: Map<string, Port>;

  constructor(parent: Composable, pos: [number, number], scale: [number, number], rotation: number, portDef: any) {
    super(parent, pos, scale, rotation);
    this.type = portDef.type;
    this.dim = [Port.style.x, Port.style.y];

    switch (this.type) {
      case 'generic':
        this.generic = portDef.generic;
        break;
      case 'stream':
        this.stream = new Port(this, [Port.style.str.px, 0], [1, 1], 0, portDef.stream);
        this.dim = [2 * Port.style.str.px + this.stream.getWidth(), Port.style.str.py + this.stream.getHeight()];
        break;
      case 'map':
        let x = 0;
        let height = 0;
        this.map = new Map<string, Port>();
        for (const k in portDef.map) {
          if (portDef.map.hasOwnProperty(k)) {
            const p = new Port(this, [x, 0], [1, 1], 0, portDef.map[k]);
            this.map.set(k, p);
            x += p.getWidth() + Port.style.map.px;
            height = Math.max(height, p.getHeight());
          }
        }
        x -= Port.style.map.px;
        this.dim = [x, height];
        break;
    }
  }

  public getType(): string {
    return this.type;
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

  public getEntry(entry: string): Port {
    return this.map.get(entry);
  }

  public justifyHorizontally() {
    const x = (this.getParent().getWidth() - this.getWidth()) / 2;
    this.setPosX(x);
  }
}
