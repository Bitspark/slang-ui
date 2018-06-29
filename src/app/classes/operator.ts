import {buildRefString, connectDeep, expandProperties, parseRefString} from '../utils';
import {OperatorService} from '../services/operator.service';
import {Mat2, Mat3} from './matrix';

export enum Type {
  number,
  binary,
  boolean,
  string,
  trigger,
  primitive,
  generic,
  stream,
  map,
}

export class OperatorDef {

  private readonly name: string;
  private def: any;
  private genericNames = new Set<string>();
  private propertyDefs = new Map<string, any>();
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

  public static isStream(portDef: any) {
    return portDef['type'] === 'stream';
  }

  public static isMap(portDef: any) {
    return portDef['type'] === 'map';
  }

  public static isGeneric(portDef: any) {
    return portDef['type'] === 'generic';
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

  public static walkAllPorts(opDef: any, fn: (p: any) => void) {
    ['services', 'delegates'].forEach(n => {
      const portGroup = opDef[n];
      if (portGroup) {
        for (const name in portGroup) {
          if (portGroup.hasOwnProperty(name)) {
            this.walkPort(portGroup[name].in, fn);
            this.walkPort(portGroup[name].out, fn);
          }
        }
      }
    });
  }

  public static walkPort(p: any, fn: (p: any) => void): void {
    fn(p);
    if (OperatorDef.isMap(p)) {
      for (const subname in p.map) {
        if (p.map.hasOwnProperty(subname)) {
          this.walkPort(p.map[subname], fn);
        }
      }
    } else if (OperatorDef.isStream(p)) {
      this.walkPort(p.stream, fn);
    }
  }

  constructor({name, def, type, saved}: { name: string, def: any, type: string, saved: boolean }) {
    this.name = name;
    this.def = def;
    this.type = type;
    this.saved = saved;
    OperatorDef.walkAllPorts(this.def, pDef => {
      if (OperatorDef.isGeneric(pDef)) {
        this.genericNames.add(pDef.generic);
      }
    });
    if (def.properties) {
      for (const propName in def.properties) {
        if (def.properties.hasOwnProperty(propName)) {
          this.propertyDefs.set(propName, def.properties[propName]);
        }
      }
    }
  }

  public getName(): string {
    return this.name;
  }

  public getGenericNames(): Set<string> {
    return this.genericNames;
  }

  public getPropertyDefs(): Map<string, any> {
    return this.propertyDefs;
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

  public translate(vec: [number, number]): Transformable {
    this.mat.multiply(new Mat3([
      1, 0, vec[0],
      0, 1, vec[1],
      0, 0, 1
    ]));
    return this;
  }

  private transformNormalized(trans: Mat3): Transformable {
    const tlX = this.getWidth() / 2;
    const tlY = this.getHeight() / 2;
    // Invert transformation
    const mat = this.mat.copy();
    const invmat = this.mat.copy().inverse();
    this.mat.multiply(invmat);
    // Translate to center
    this.translate([-tlX, -tlY]);
    // Apply actual transformation
    this.mat.multiply(trans);
    // Invert translate to center
    this.translate([tlX, tlY]);
    // Invert inversion matrix
    this.mat.multiply(mat);
    return this;
  }

  public scale(vec: [number, number]): Transformable {
    return this.transformNormalized(new Mat3([
      vec[0], 0, 0,
      0, vec[1], 0,
      0, 0, 1
    ]));
  }

  public rotate(angle: number): Transformable {
    const rot = Mat2.identity.copy().rotate(angle).all();
    return this.transformNormalized(new Mat3([
      rot[0], rot[1], 0,
      rot[2], rot[3], 0,
      0, 0, 1
    ]));
  }

  public resize(vec: [number, number]): Transformable {
    this.dim[0] += vec[0];
    this.dim[1] += vec[1];
    return this;
  }

  public getWidth(): number {
    return this.dim[0];
  }

  public getHeight(): number {
    return this.dim[1];
  }

  public getPosX(): number {
    return this.mat.at(2);
  }

  public getPosY(): number {
    return this.mat.at(5);
  }

  public col(idx): number[] {
    return this.mat.col(idx);
  }
}

export class Composable extends Transformable {
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

  public getOrientation(): number {
    const mat = this.getAbsMat3();
    const vec = new Mat3([
      0, 0, 0,
      0, 0, 1,
      0, 0, 0]);
    const orientation = vec.multiply(mat);
    if (orientation.at(5) > 0.1) {
      return 0; // north
    }
    if (orientation.at(2) > 0.1) {
      return 1; // east
    }
    if (orientation.at(5) < -0.1) {
      return 2; // south
    }
    if (orientation.at(2) < -0.1) {
      return 3; // west
    }
    return -1;
  }

}

export class OperatorInstance extends Composable {
  private static style = {
    opMinWidth: 100,
    opMinHeight: 100,
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
  private operatorType: string;
  private properties: any;

  constructor(private operatorSrv: OperatorService,
              private fqOperator: string,
              private name: string,
              public opDef: OperatorDef,
              properties: any,
              parent: Composable,
              def: any,
              dim?: [number, number]) {
    super(parent);
    const op = this.operatorSrv.getOperator(fqOperator);
    this.operatorType = op[1];
    this.instances = new Map<string, OperatorInstance>();
    this.connections = new Set<Connection>();
    this.properties = properties;
    this.updateOperator(def, properties, dim);
  }

  public updateOperator(def: any, props: any, dim?: [number, number]) {
    let [width, height] = (this.dim) ? this.dim : (dim) ? dim : [0, 0];

    this.properties = props;

    this.mainIn = new Port(this, 'service', 'main', true, null, '', this, def.services['main']['in']);
    const tmpMainOut = new Port(this, 'service', 'main', false, null, '', this, def.services['main']['out']);
    width = Math.max(width, this.mainIn.getWidth(), tmpMainOut.getWidth() + 10, OperatorInstance.style.opMinWidth);
    height = Math.max(height, this.mainIn.getHeight() + 10);

    let dlgHeight = OperatorInstance.style.dlgP;
    this.delegates = new Map<string, PortGroup>();
    if (def.delegates) {
      for (const dlgName in def.delegates) {
        if (def.delegates.hasOwnProperty(dlgName)) {
          width = Math.max(width, 130);
          const dlgDef = def.delegates[dlgName];
          const dlg = new Delegate(this, dlgName, this, dlgDef);
          dlgHeight += dlg.getWidth();
          dlg
            .rotate(-Math.PI / 2)
            .translate([width, dlg.getWidth() / 2])
            .scale([1, -1])
            .translate([-dlg.getWidth() / 2 - 7, 0]);
          this.delegates.set(dlgName, dlg);
          dlgHeight += OperatorInstance.style.dlgM;
        }
      }
    }
    height = Math.max(height, dlgHeight + OperatorInstance.style.dlgP, OperatorInstance.style.opMinHeight);

    this.dim = [width, height];
    this.mainOut = new Port(this, 'service', 'main', false, null, '', this, def.services['main']['out']);
    this.mainOut.scale([1, -1]).translate([0, height]);

    this.mainIn.translate([0, -7]);
    this.mainOut.translate([0, -7]);
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
          if (!op) {
            continue;
          }
          let opIns = this.instances.get(insName);
          let opDef = JSON.parse(JSON.stringify(op[0].getDef()));
          OperatorDef.specifyOperatorDef(opDef, ins['generics'], ins['properties'], opDef['properties']);
          opDef = {
            services: opDef['services'],
            delegates: opDef['delegates']
          };
          if (typeof opIns === 'undefined') {
            opIns = new OperatorInstance(this.operatorSrv, opName, insName, op[0], ins['properties'], this, opDef);
            opIns.translate([
              Math.random() * (this.dim[0] - OperatorInstance.style.opMinWidth),
              Math.random() * (this.dim[1] - OperatorInstance.style.opMinHeight)]);
          } else {
            opIns.updateOperator(opDef, ins['properties']);
          }
          this.instances.set(insName, opIns);
          opIns.show();
        }
      }
    }

    if (connections) {
      this.connections = connectDeep(this, connections);
    }
  }

  public updateVisual(visual: any) {
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
      geometry: {
        x: this.getAbsX(),
        y: this.getAbsY(),
        width: this.getWidth(),
        height: this.getHeight()
      }
    };
    this.instances.forEach((ins, insName) => {
      visual.instances[insName] = ins.mat.all();
    });
    return visual;
  }

  public renameInstance(oldName: string, newName: string) {
    const ins = this.instances.get(oldName);
    const oDef = this.opDef.getDef();

    // Replace operator entry
    oDef.operators[newName] = JSON.parse(JSON.stringify(oDef.operators[oldName]));
    delete oDef.operators[oldName];

    // Step 1: adapt destinations
    for (const src in oDef.connections) {
      if (oDef.connections.hasOwnProperty(src)) {
        const newDsts = [];
        for (const dst of oDef.connections[src]) {
          const dstInfo = parseRefString(dst);
          if (dstInfo.instance === oldName) {
            dstInfo.instance = newName;
            const newDst = buildRefString(dstInfo);
            newDsts.push(newDst);
          } else {
            newDsts.push(dst);
          }
        }
        oDef.connections[src] = newDsts;
      }
    }

    // Step 2: adapt sources
    const newConns = {};
    for (const src in oDef.connections) {
      if (oDef.connections.hasOwnProperty(src)) {
        const srcInfo = parseRefString(src);
        if (srcInfo.instance === oldName) {
          srcInfo.instance = newName;
          const newSrc = buildRefString(srcInfo);
          newConns[newSrc] = oDef.connections[src];
        } else {
          newConns[src] = oDef.connections[src];
        }
      }
    }

    oDef.connections = newConns;

    ins.setName(newName);

    this.instances.set(newName, ins);
    this.instances.delete(oldName);
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

  public setName(name: string) {
    this.name = name;
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

  public getPrimitivePorts(): Array<Port> {
    let ports: Array<Port> = [];
    ports = ports.concat(this.mainOut.getPrimitivePorts()).concat(this.mainIn.getPrimitivePorts());
    if (this.services) {
      Array.from(this.services.values()).forEach(srv => {
        ports = ports.concat(srv.getPrimitivePorts());
      });
    }
    if (this.delegates) {
      Array.from(this.delegates.values()).forEach(dlg => {
        ports = ports.concat(dlg.getPrimitivePorts());
      });
    }
    this.instances.forEach(ins => {
      if (ins.visible) {
        ports = ports.concat(ins.getPrimitivePorts());
      }
    });
    return ports;
  }

  public getPort(ref: string): Port {
    const portInfo = parseRefString(ref);
    if (typeof portInfo.instance === 'undefined') {
      return null;
    }

    let o: OperatorInstance = null;
    let p: Port = null;
    if (portInfo.instance === '') {
      o = this;
    } else {
      o = this.instances.get(portInfo.instance);
    }

    if (portInfo.service === 'main') {
      if (portInfo.dirIn) {
        p = o.getMainIn();
      } else {
        p = o.getMainOut();
      }
    } else if (portInfo.service) {
      const srv = o.getService(portInfo.service);
      if (srv) {
        if (portInfo.dirIn) {
          p = srv.getIn();
        } else {
          p = srv.getOut();
        }
      } else {
        return null;
      }
    } else if (portInfo.delegate) {
      const dlg = o.getDelegate(portInfo.delegate);
      if (dlg) {
        if (portInfo.dirIn) {
          p = dlg.getIn();
        } else {
          p = dlg.getOut();
        }
      } else {
        return null;
      }
    }

    const pathSplit = portInfo.port.split('.');
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

      if (!p.isMap()) {
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

  public getGenericNames(): Set<string> {
    return this.opDef.getGenericNames();
  }

  public getPropertyDefs(): Map<string, any> {
    return this.opDef.getPropertyDefs();
  }

  public getOperatorType(): string {
    return this.operatorType;
  }

  public getFullyQualifiedName(): string {
    return this.fqOperator;
  }

  public getProperties(): any {
    return this.properties;
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
    const centerY = (this.getHeight() - y - OperatorInstance.style.dlgP) / 2;
    this.delegates.forEach(dlg => {
      dlg.translate([0, centerY]);
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
    this.in.translate([0, -7]);
    this.out = new Port(operator, groupType, groupName, false, null, '', this, portGrpDef.out);
    this.out.translate([0, -14]).translate([this.in.getWidth() + 5, 0]);
    this.dim = [this.in.getWidth() + this.out.getWidth() + 10, Math.max(this.in.getHeight(), this.out.getHeight())];
  }

  public getIn(): Port {
    return this.in;
  }

  public getOut(): Port {
    return this.out;
  }

  public getPrimitivePorts(): Array<Port> {
    return this.in.getPrimitivePorts().concat(this.out.getPrimitivePorts());
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
    x: 17,
    y: 14,

    str: {
      px: 4,
      py: 4,
    },

    map: {
      px: 4,
    },

    /* Deprecated
     */
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

  private type: Type;
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
    this.type = Type[portDef.type as string];
    this.dim = [Port.style.x, Port.style.y];

    switch (this.type) {
      case Type.generic:
        this.generic = portDef.generic;
        break;
      case Type.stream:
        this.stream = new Port(this.operator, this.groupType, this.groupName, inDir, this, '', this, portDef.stream);
        this.stream.translate([Port.style.str.px, 0]);
        this.dim = [2 * Port.style.str.px + this.stream.getWidth(), Port.style.str.py + this.stream.getHeight()];
        break;
      case Type.map:
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

  public getType(): Type {
    return this.type;
  }

  public getTypeDef(): any {
    const typeDef = {
      type: this.getType()
    };
    if (this.isGeneric()) {
      typeDef['generic'] = this.generic;
    } else if (this.isStream()) {
      typeDef['stream'] = this.stream.getTypeDef();
    } else if (this.isMap()) {
      typeDef['map'] = {};
      this.map.forEach((entry, key) => {
        typeDef['map'][key] = entry.getTypeDef();
      });
    }
    return typeDef;
  }

  public getOperator(): OperatorInstance {
    return this.operator;
  }

  public isPrimitive(): boolean {
    return this.type === Type.number ||
      this.type === Type.string ||
      this.type === Type.binary ||
      this.type === Type.boolean ||
      this.type === Type.primitive ||
      this.type === Type.trigger;
  }

  public isGeneric(): boolean {
    return this.type === Type.generic;
  }

  public isStream(): boolean {
    return this.type === Type.stream;
  }

  public isMap(): boolean {
    return this.type === Type.map;
  }

  public getMap(): Map<string, Port> {
    return this.map;
  }

  public getGeneric(): string {
    return this.generic;
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
    if (this.parentPort.isMap()) {
      if (parentRefString === '') {
        return this.name;
      }
      return parentRefString + '.' + this.name;
    } else if (this.parentPort.isStream()) {
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
    return Port.style.portColors[Type[this.type] as string];
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

  public getParentPort(): Port {
    return this.parentPort;
  }

  public getPrimitivePorts(): Array<Port> {
    switch (this.type) {
      case Type.stream:
        return this.stream.getPrimitivePorts();
      case Type.map:
        let ports: Array<Port> = [];
        Array.from(this.map.values()).forEach(p => {
          ports = ports.concat(p.getPrimitivePorts());
        });
        return ports;
      default:
        return [this];
    }
  }

  public getName(): string {
    let portName = (this.parentPort) ? this.parentPort.getName() : '';
    if (portName) {
      if (this.name) {
        portName += '.' + this.name;
      }
    } else {
      portName = this.name;
    }
    return portName;
  }
}
