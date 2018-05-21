import {expandProperties, generateSvgTransform} from '../utils';
import {OperatorService} from '../services/operator.service';
import {Mat2, Mat3} from './matrix';

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
  protected mat: Mat3;

  constructor() {
    this.mat = Mat3.identity.copy();
  }

  public translate(vec: [number, number]) {
    this.mat.multiply(new Mat3([
      1, 0, vec[0],
      0, 1, vec[1],
      0, 0, 1
    ]));
  }

  public scale(vec: [number, number]) {
    this.mat.multiply(new Mat3([
      vec[0], 0, 0,
      0, vec[1], 0,
      0, 0, 1
    ]));
  }

  public rotate(angle: number) {
    const rot = Mat2.identity.copy().rotate(angle).all();
    this.mat.multiply(new Mat3([
      rot[0], rot[1], 0,
      rot[2], rot[3], 0,
      0, 0, 1
    ]));
  }

  public getWidth(): number {
    return this.dim[0];
  }

  public getHeight(): number {
    return this.dim[1];
  }

  public col(idx): number[] {
    return this.mat.col(idx);
  }

  public getPosX(): number {
    return this.mat.at(2);
  }

  public getPosY(): number {
    return this.mat.at(5);
  }
}


class Composable extends Transformable {
  constructor(private parent: Composable) {
    super();
  }

  public getParent(): Composable {
    return this.parent;
  }

  protected getAbsMat3() {
    return !!this.parent ? this.mat.copy().multiply(this.parent.getAbsMat3()) : this.mat.copy();
  }

  public getAbsX(): number {
    return this.getAbsMat3().at(2);
  }

  public getAbsY(): number {
    return this.getAbsMat3().at(5);
  }
}

export class OperatorInstance extends Composable {

  private static style = {
    dlgP: 10,
    dlgM: 5
  };

  private mainIn: Port;
  private mainOut: Port;
  private services: Map<string, PortGroup>;
  private delegates: Map<string, PortGroup>;
  private instances: Map<string, OperatorInstance>;
  private connections: Set<Connection>;
  private visible: boolean;

  constructor(private operatorSrv: OperatorService,
              private fqOperator: string,
              private name: string,
              parent: Composable,
              def: any,
              dim?: [number, number]) {
    super(parent);
    this.instances = new Map<string, OperatorInstance>();
    this.connections = new Set<Connection>();
    this.updateOperator(def, dim);
  }

  public updateOperator(def: any, dim?: [number, number]) {
    let [width, height] = (this.dim) ? this.dim : (dim) ? dim : [0, 0];

    this.mainIn = new Port(this, 'service', 'main', true, null, '', this, def.services['main']['in']);
    const tmpMainOut = new Port(this, 'service', 'main', false, null, '', this, def.services['main']['out']);
    width = Math.max(width, this.mainIn.getWidth(), tmpMainOut.getWidth() + 10, 130);
    height = Math.max(height, this.mainIn.getHeight() + 10);

    let dlgHeight = OperatorInstance.style.dlgP;
    this.delegates = new Map<string, PortGroup>();
    if (def.delegates) {
      for (const dlgName in def.delegates) {
        if (def.delegates.hasOwnProperty(dlgName)) {
          const dlgDef = def.delegates[dlgName];
          const dlg = new Delegate(this, dlgName, this, dlgDef);
          dlgHeight += dlg.getWidth();
          dlg.scale([-1, 1]);
          dlg.rotate(Math.PI / 2);
          dlg.translate([width, dlg.getWidth()]);
          this.delegates.set(dlgName, dlg);
          dlgHeight += OperatorInstance.style.dlgM;
        }
      }
    }
    height = Math.max(height, dlgHeight + OperatorInstance.style.dlgP, 60);

    this.dim = [width, height];
    this.mainOut = new Port(this, 'service', 'main', false, null, '', this, def.services['main']['out']);
    this.mainOut.scale([1, -1]);
    this.mainOut.translate([0, height]);

    this.mainIn.justifyHorizontally();
    this.mainOut.justifyHorizontally();
    this.distributeDelegatesVertically();

    this.updateInstances(def.operators, def.connections);
  }

  public updateInstances(instances: any, connections: any) {
    if (instances) {
      this.instances.forEach(ins => ins.hide());
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
          let opIns = this.instances.get(insName);
          let ipos: [number, number];
          if (typeof opIns !== 'undefined') {
            ipos = [opIns.getPosX(), opIns.getPosY()];
          } else {
            ipos = [Math.random() * 1000, Math.random() * 1000];
          }
          if (!op) {
            continue;
          }
          const opDef = JSON.parse(JSON.stringify(op.getDef()));
          OperatorDef.specifyOperatorDef(opDef, ins['generics'], ins['properties'], opDef['properties']);
          opIns = new OperatorInstance(this.operatorSrv, opName, insName, this, opDef);
          opIns.translate(ipos);
          this.instances.set(insName, opIns);
          opIns.show();
        }
      }
    }

    if (connections) {
      this.connections = new Set<Connection>();
      for (const src in connections) {
        if (connections.hasOwnProperty(src)) {
          for (const dst of connections[src]) {
            const conns = this.getPort(src).connectDeep(this.getPort(dst));
            conns.forEach(conn => this.connections.add(conn));
          }
        }
      }
    }
  }

  public updateVisual(visual: any) {
    this.mat = new Mat3([1, 0, visual.pos.x, 0, 1, visual.pos.y, 0, 0, 1]);
    for (const insName in visual.instances) {
      if (visual.instances.hasOwnProperty(insName)) {
        const ins = this.instances.get(insName);
        if (!ins) {
          continue;
        }
        ins.mat = new Mat3(visual.instances[insName]);
      }
    }
  }

  public getVisual(): any {
    const visual = {
      instances: {},
      pos: {
        x: this.getAbsX(),
        y: this.getAbsY(),
      }
    };
    this.instances.forEach((ins, insName) => {
      visual.instances[insName] = ins.mat.all();
    });
    return visual;
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

  public getConnections(): Set<Connection> {
    return this.connections;
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

  private distributeDelegatesVertically() {
    if (!this.delegates) {
      return;
    }
    let y = OperatorInstance.style.dlgP;
    this.delegates.forEach(dlg => {
      dlg.translate([0, y]);
      y += dlg.getWidth();
      y += OperatorInstance.style.dlgM;
    });
  }
}

export class Connection {
  constructor(private src: Port, private dst: Port) {
    if (!src) {
      console.error('source null', src);
    }
    if (!dst) {
      console.error('destination null', dst);
    }
  }

  public getSource(): Port {
    return this.src;
  }

  public getDestination(): Port {
    return this.dst;
  }
}

export class PortGroup extends Composable {
  private in: Port;
  private out: Port;

  constructor(operator: OperatorInstance,
              groupType: string,
              groupName: string,
              parent: Composable,
              portGrpDef: any) {
    super(parent);
    this.in = new Port(operator, groupType, groupName, true, null, '', this, portGrpDef.in);
    this.out = new Port(operator, groupType, groupName, false, null, '', this, portGrpDef.out);
    this.out.translate([this.in.getWidth() + 5, 0]);
    this.dim = [this.in.getWidth() + this.out.getWidth() + 10, Math.max(this.in.getHeight(), this.out.getHeight())];
  }

  public getIn(): Port {
    return this.in;
  }

  public getOut(): Port {
    return this.out;
  }
}

export class Service extends PortGroup {
  constructor(operator: OperatorInstance,
              private name: string,
              parent: Composable,
              portGrpDef: any) {
    super(operator, 'service', name, parent, portGrpDef);
  }
}

export class Delegate extends PortGroup {
  constructor(operator: OperatorInstance,
              private name: string,
              parent: Composable,
              portGrpDef: any) {
    super(operator, 'delegate', name, parent, portGrpDef);
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
      px: 3,
      py: 3,
    },

    map: {
      px: 2,
    },

    portColors: {
      primitive: '#C4739C',
      number: '#0e7800',
      string: '#0095B7',
      boolean: '#BA1200',
      binary: '#870001',
      trigger: '#5d5d5d',
      generic: '#9E008E',
    }
  };

  private type: string;
  private generic: string;
  private stream: Port;
  private map: Map<string, Port>;

  /**
   * @param {OperatorInstance} operator operator this port belongs to
   * @param {string} groupType type of the group (either 'service' or 'delegate')
   * @param {string} groupName name of the service/delegate
   * @param {boolean} inDir true means in, false means out
   * @param {Port} parentPort parent port (either map or stream port)
   * @param {string} name entry name (empty string for non-map-entries)
   * @param {Composable} parent
   * @param portDef
   */
  constructor(private operator: OperatorInstance,
              private groupType: string,
              private groupName: string,
              private inDir: boolean,
              private parentPort: Port,
              private name: string,
              parent: Composable,
              portDef: any) {
    super(parent);
    this.type = portDef.type;
    this.dim = [Port.style.x, Port.style.y];

    switch (this.type) {
      case 'generic':
        this.generic = portDef.generic;
        break;
      case 'stream':
        this.stream = new Port(this.operator, this.groupType, this.groupName, inDir, this, '', this, portDef.stream);
        this.stream.translate([Port.style.str.px, 0]);
        this.dim = [2 * Port.style.str.px + this.stream.getWidth(), Port.style.str.py + this.stream.getHeight()];
        break;
      case 'map':
        let x = 0;
        let height = 0;
        this.map = new Map<string, Port>();
        for (const k in portDef.map) {
          if (portDef.map.hasOwnProperty(k)) {
            const p = new Port(this.operator, this.groupType, this.groupName, inDir, this, k, this, portDef.map[k]);
            p.translate([x, 0]);
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

  public getOperator(): OperatorInstance {
    return this.operator;
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

  /**
   * Connects ports and recursively descends to leaves in the process (with maps as well as with streams).
   *
   * @param {Port} dst destination port
   * @returns {Set<Connection>} resulting connections
   */
  public connectDeep(dst: Port): Set<Connection> {
    if (!dst) {
      return new Set<Connection>();
    }
    if (dst.isPrimitive()) {
      return new Set<Connection>([new Connection(this, dst)]);
    } else if (this.isMap()) {
      const conns = new Set<Connection>();
      this.map.forEach((entryPort, entryKey) => {
        entryPort.connectDeep(dst.map.get(entryKey)).forEach(conn => {
          conns.add(conn);
        });
      });
      return conns;
    } else if (this.isStream()) {
      return this.getStream().connectDeep(dst.getStream());
    } else if (this.isGeneric()) {
      return new Set<Connection>([new Connection(this, dst)]);
    }
    return new Set<Connection>();
  }

  private getPortRefString(): string {
    if (!this.parentPort) {
      return '';
    }
    const parentRefString = this.parentPort.getPortRefString();
    if (this.parentPort.type === 'map') {
      if (parentRefString === '') {
        return this.name;
      }
      return parentRefString + '.' + this.name;
    } else if (this.parentPort.type === 'stream') {
      if (parentRefString === '') {
        return '~';
      }
      return parentRefString + '.~';
    }
    return parentRefString;
  }

  public getRefString(): string {
    const portRefString = this.getPortRefString();
    let opName = this.operator.getName();
    if (this.groupType === 'service') {
      if (this.groupName !== 'main') {
        opName = this.groupName + '@' + opName;
      }
    } else if (this.groupType === 'delegate') {
      opName = opName + '.' + this.groupName;
    }
    if (this.inDir) {
      return portRefString + '(' + opName;
    } else {
      return opName + ')' + portRefString;
    }
  }

  public getColor(): string {
    return Port.style.portColors[this.type];
  }

  public isIn(): boolean {
    return this.inDir;
  }

  public isOut(): boolean {
    return !this.inDir;
  }

  public justifyHorizontally() {
    const x = (this.getParent().getWidth() - this.getWidth()) / 2;
    this.translate([x, 0]);
  }

  public getPortMat(): Mat3 {
    const point = [this.getWidth() / 2, 0];
    return new Mat3([1, 0, point[0], 0, 1, point[1], 0, 0, 1]);
  }

  public getPortPosX(): number {
    return this.getPortMat().multiply(this.getAbsMat3()).at(2);
  }

  public getPortPosY(): number {
    return this.getPortMat().multiply(this.getAbsMat3()).at(5);
  }
}
