import {Composable, Connection, OperatorDef, OperatorInstance, Orientation, Port, Transformable} from './classes/operator';
import {Mat3} from './classes/matrix';

function expandExpressionPart(exprPart: string, props: any, propDefs: any): Array<string> {
  const vals = [];
  if (!props) {
    return vals;
  }
  const prop = props[exprPart];
  if (!prop) {
    return [];
  }
  const propDef = propDefs[exprPart];
  if (propDef['type'] === 'stream') {
    for (const el of prop) {
      if (typeof el !== 'string') {
        vals.push(JSON.stringify(el));
      } else {
        vals.push(el);
      }
    }
  } else {
    vals.push(JSON.stringify(prop));
  }
  return vals;
}

export function expandProperties(str: string, props: any, propDefs: any): Array<string> {
  let exprs = [str];
  for (const expr of exprs) {
    const parts = /{(.*?)}/.exec(expr);
    if (!parts) {
      break;
    }

    // This could be extended with more complex logic in the future
    const vals = expandExpressionPart(parts[1], props, propDefs);

    // Actual replacement
    const newExprs = [];
    for (const val of vals) {
      for (const e of exprs) {
        newExprs.push(e.replace(parts[0], val));
      }
    }
    exprs = newExprs;
  }
  return exprs;
}

export function generateSvgTransform(t: Transformable): string {
  const cols = t.col(0).slice(0, 2).concat(t.col(1).slice(0, 2).concat(t.col(2).slice(0, 2)));
  return `matrix(${cols.join(',')})`;
}

function normalizeStreams(conns: Set<Connection>): boolean {
  let modified = false;
  conns.forEach(conn => {
    if (conn.getSource().getParentPort() && conn.getDestination().getParentPort() &&
      conn.getSource().getParentPort().isStream() && conn.getDestination().getParentPort().isStream()) {
      conns.delete(conn);
      conns.add(new Connection(conn.getSource().getParentPort(), conn.getDestination().getParentPort()));
      modified = true;
    }
  });
  return modified;
}

const FoundException = {};
const NotFoundException = {};

function containsConnection(conns: Set<Connection>, src: Port, dst: Port): boolean {
  try {
    conns.forEach(searchConn => {
      if (searchConn.getSource() === src && searchConn.getDestination() === dst) {
        throw FoundException;
      }
    });
  } catch (e) {
    if (e !== FoundException) {
      throw e;
    }
    return true;
  }
  return false;
}

function normalizeMaps(conns: Set<Connection>): boolean {
  let modified = false;
  conns.forEach(conn => {
    const srcMap = conn.getSource().getParentPort();
    const dstMap = conn.getDestination().getParentPort();
    if (srcMap && dstMap && srcMap.isMap() && dstMap.isMap()) {
      // First, check if parent map is already connected
      // In that case we don't need to do anything
      if (containsConnection(conns, srcMap, dstMap)) {
        return;
      }

      // Look if all siblings are connected as well

      let connected = true;
      // Look if source map is completely connected
      try {
        srcMap.getMap().forEach((entry, entryName) => {
          const dstEntry = dstMap.getMap().get(entryName);
          if (!dstEntry) {
            throw NotFoundException;
          }
          if (!containsConnection(conns, entry, dstEntry)) {
            connected = false;
          }
        });
      } catch (e) {
        if (e !== NotFoundException) {
          throw e;
        }
        return;
      }
      if (!connected) {
        return;
      }

      // Look if destination map is completely connected
      try {
        dstMap.getMap().forEach((entry, entryName) => {
          const srcEntry = srcMap.getMap().get(entryName);
          if (!srcEntry) {
            throw NotFoundException;
          }
          if (!containsConnection(conns, srcEntry, entry)) {
            connected = false;
          }
        });
      } catch (e) {
        if (e !== NotFoundException) {
          throw e;
        }
        return;
      }
      if (!connected) {
        return;
      }

      // Remove all the obsolete connections
      srcMap.getMap().forEach((entry, entryName) => {
        const dstEntry = dstMap.getMap().get(entryName);
        conns.forEach(searchConn => {
          if (searchConn.getSource() === entry && searchConn.getDestination() === dstEntry) {
            conns.delete(searchConn);
          }
        });
      });
      conns.add(new Connection(srcMap, dstMap));
      modified = true;
    }
  });
  return modified;
}

export function normalizeConnections(conns: Set<Connection>) {
  let modified = true;
  while (modified) {
    modified = false;
    modified = normalizeStreams(conns) || modified;
    modified = normalizeMaps(conns) || modified;
  }
}

export function connectDeep(op: OperatorInstance, connections: any): Set<Connection> {
  const connSet = new Set<Connection>();
  for (const src in connections) {
    if (connections.hasOwnProperty(src)) {
      for (const dst of connections[src]) {
        const conns = op.getPort(src).connectDeep(op.getPort(dst));
        conns.forEach(conn => connSet.add(conn));
      }
    }
  }
  return connSet;
}

export function stringifyConnections(conns: Set<Connection>): any {
  const connObj = {};
  conns.forEach(conn => {
    const srcRef = conn.getSource().getRefString();
    const dstRef = conn.getDestination().getRefString();
    if (!connObj[srcRef]) {
      connObj[srcRef] = [];
    }
    connObj[srcRef].push(dstRef);
  });
  return connObj;
}

export function createDefaultValue(typeDef: any): any {
  switch (typeDef.type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'trigger':
      return null;
    case 'primitive':
      return '';
    case 'map':
      const typeValue = {};
      for (const key in typeDef.map) {
        if (typeDef.map.hasOwnProperty(key)) {
          typeValue[key] = createDefaultValue(typeDef.map[key]);
        }
      }
      return typeValue;
    case 'stream':
      return [];
    case 'generic':
      return '$value';
  }
}

export function compareOperatorDefs(lhs, rhs: OperatorDef): number {
  return (lhs.getName() < rhs.getName()) ? -1 : 1;
}

export function parseRefString(ref: string): { instance: string, delegate: string, service: string, dirIn: boolean, port: string } {
  if (ref.length === 0) {
    return null;
  }

  const ret = {
    instance: undefined,
    delegate: undefined,
    service: undefined,
    dirIn: undefined,
    port: undefined
  };

  let sep = '';
  let opIdx = 0;
  let portIdx = 0;
  if (ref.indexOf('(') !== -1) {
    ret.dirIn = true;
    sep = '(';
    opIdx = 1;
    portIdx = 0;
  } else if (ref.indexOf(')') !== -1) {
    ret.dirIn = false;
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
  ret.port = refSplit[portIdx];

  if (opPart === '') {
    ret.instance = '';
    ret.service = 'main';
  } else {
    if (opPart.indexOf('.') !== -1 && opPart.indexOf('@') !== -1) {
      // Delegate and service must not both occur in string
      return null;
    }
    if (opPart.indexOf('.') !== -1) {
      const opSplit = opPart.split('.');
      if (opSplit.length === 2) {
        ret.instance = opSplit[0];
        ret.delegate = opSplit[1];
      }
    } else if (opPart.indexOf('@') !== -1) {
      const opSplit = opPart.split('@');
      if (opSplit.length === 2) {
        ret.instance = opSplit[1];
        ret.service = opSplit[0];
      }
    } else {
      ret.instance = opPart;
      ret.service = 'main';
    }
  }

  return ret;
}

export function buildRefString(info: { instance: string, delegate: string, service: string, dirIn: boolean, port: string }): string {
  let opStr = '';
  if (typeof info.service !== 'undefined') {
    if (info.service === 'main' || info.service === '') {
      opStr = info.instance;
    } else {
      opStr = `${info.service}@${info.instance}`;
    }
  } else if (typeof info.delegate !== 'undefined') {
    opStr = `${info.instance}.${info.delegate}`;
  }

  if (info.dirIn) {
    return `${info.port}(${opStr}`;
  } else {
    return `${opStr})${info.port}`;
  }
}

class Vec2 {
  public x = 0;
  public y = 0;
  private o = new Orientation(Orientation.north);

  constructor(p: [number, number], o?: Orientation) {
    this.x = p[0];
    this.y = p[1];
    if (o) {
      this.o = o;
    }
  }

  public static combine(v1: Vec2, v2: Vec2): Vec2 {
    return new Vec2([v1.x, v2.y], v1.o);
  }

  public static copy(v: Vec2): Vec2 {
    return new Vec2([v.x, v.y], v.o);
  }

  public static null(): Vec2 {
    return new Vec2([0, 0], new Orientation(Orientation.north));
  }

  public translate(t: Vec2): Vec2 {
    return this.plus(t);
  }

  public rotate(rotBy90deg: number): Vec2 {
    if (rotBy90deg < 0) {
      rotBy90deg = 4 + rotBy90deg;
    }
    rotBy90deg %= 4;
    const o = new Orientation(this.o.value() + rotBy90deg);
    let x = this.x;
    let y = this.y;
    // rotation to right
    for (let i = 0; i < rotBy90deg; i++) {
      [x, y] = [-y, x];
    }
    return new Vec2([x, y], o);
  }

  public scale(s: number): Vec2 {
    return this.mult(s);
  }

  public minus(v: Vec2): Vec2 {
    return new Vec2([this.x - v.x, this.y - v.y], this.o);
  }

  public plus(v: Vec2): Vec2 {
    return new Vec2([this.x + v.x, this.y + v.y], this.o);
  }

  public mult(k: number): Vec2 {
    return new Vec2([this.x * k, this.y * k], this.o);
  }

  public div(k: number): Vec2 {
    return this.mult(1 / k);
  }

  public neg(): Vec2 {
    return new Vec2([-this.x, -this.y], this.o);
  }

  public flip(): Vec2 {
    return new Vec2([this.y, this.x], this.o);
  }

  public xy(): [number, number] {
    return [this.x, this.y];
  }

  public orient(): Orientation {
    return this.o;
  }
}

export class SVGPolylineGenerator {
  private points: Array<Vec2> = [];
  private normTrl: Vec2;
  private normRot90Deg: number;

  private constructor(private outerOperator, private conn: Connection) {
    const src = conn.getSource();
    const dst = conn.getDestination();

    this.normTrl = new Vec2(src.getCenter());
    this.normRot90Deg = src.getOrientation().value();

    if (src.getOperator() === this.outerOperator) {
      this.normRot90Deg = (this.normRot90Deg + 2) % 4;
    }

    const sOrigin = Vec2.null();
    let dOrigin;

    if (dst.getOperator() === this.outerOperator) {
      dOrigin = new Vec2(dst.getCenter(), new Orientation(dst.getOrientation().value() + 2)).translate(this.normTrl.neg()).rotate(-this.normRot90Deg);
    } else {
      dOrigin = new Vec2(dst.getCenter(), dst.getOrientation()).translate(this.normTrl.neg()).rotate(-this.normRot90Deg);
    }


    const padding = new Vec2([50, 50]);
    const start = this.calcOffset(sOrigin, padding);
    const end = this.calcOffset(dOrigin, padding);
    const mid = start.plus(end.minus(start).div(2));
    const dist = end.minus(start);

    this.addPoints([sOrigin, start]);

    const o = dOrigin.orient();

    /* direct connection */
    if (dist.y <= 0) {
      // Upper half
      if (o.isWest() && dist.x >= 0) {
        // Upper right
        /*
            .--->O
            |
            O
         */
        this.addPoints([Vec2.combine(start, end)]);
        this.addPoints([end, dOrigin]);
        return;
      } else if (o.isEast() && dist.x <= 0) {
        // Upper left
        /*
            O<---.
                 |
                 O
         */
        this.addPoints([Vec2.combine(start, end)]);
        this.addPoints([end, dOrigin]);
        return;
      }
      // Upper half
    }

    /* connection via 1 additional line */
    if (dist.y <= 0) {
      if (o.isSouth()) {
        /*
            O         O
            A         A
            '--.   .--•
               O   O
         */
        this.addPoints([Vec2.combine(end, start)]);
        this.addPoints([end, dOrigin]);
        return;
      } else if (o.isNorth()) {
        if (Math.abs(dist.x) <= 100) {
          /*
             .---.
             V   |
             O   |
             .---'
             O
           */
          const p = new Vec2([Math.sign(dist.x) * 200, 0]);
          this.addPoints([Vec2.combine(p, start), Vec2.combine(p, end)]);
          this.addPoints([end, dOrigin]);
        } else {
          /*
             .---.   .---.
             |   V   V   |
             |   O   O   |
             O           O
           */
          this.addPoints([Vec2.combine(start, end)]);
          this.addPoints([end, dOrigin]);
          return;
        }
      }
    } else {
      if (o.isNorth()) {
        if (Math.abs(dist.x) <= 100) {
          /*
             .---.
             O   |
             .---'
             V
             O
           */
          const p = new Vec2([Math.sign(dist.x) * 100, 0]);
          this.addPoints([Vec2.combine(p, start), Vec2.combine(p, end)]);
          this.addPoints([end, dOrigin]);
        } else {
          /*
             .---.   .---.
             O   V   V   O
                 O   O
           */
          this.addPoints([Vec2.combine(end, start)]);
          this.addPoints([end, dOrigin]);
          return;
        }
      }
    }

    /* connection via 2 additional lines */
    if (dist.y > 0) {
      if (o.isHorizontally()) {
        if (Math.abs(dist.x) <= 100) {
          /*
             .--.   .--.
             O  |   |  O
             O<-'   `->O
           */
          const p = new Vec2([(o.isWest()) ? -100 : 100, 0]);
          this.addPoints([Vec2.combine(p, start), Vec2.combine(p, end)]);
          this.addPoints([end, dOrigin]);
          return;
        } else {
          /*
              .--.       .---.  .->O
              O  |       O   |  '---.
                 `-->O    O<-'      O
              .---.       .--.   O<-.
              |   O       |  O  .---'
              '->O    O<--'     O
           */
          if (Math.abs(dist.y) <= 100) {
            const c = end.y - 100;
            const p = new Vec2([c, c]);
            this.addPoints([Vec2.combine(start, p), Vec2.combine(end, p)]);
            this.addPoints([end, dOrigin]);
            return;
          } else {
            this.addPoints([Vec2.combine(end, start)]);
            this.addPoints([end, dOrigin]);
            return;
          }
        }
      }
    } else {
      if (o.isHorizontally()) {
        if (Math.abs(dist.y) <= 100) {
          /*
             .--.   .--.
             O  |   |  O
             O<-'   `->O
           */
          const c = end.y - 100;
          const p = new Vec2([c, c]);
          this.addPoints([Vec2.combine(start, p), Vec2.combine(end, p)]);
          this.addPoints([end, dOrigin]);
          return;
        } else {
          /*
              .--.       .---.  .->O
              O  |       O   |  '---.
                 `-->O    O<-'      O
              .---.       .--.   O<-.
              |   O       |  O  .---'
              '->O    O<--'     O
           */
          this.addPoints([Vec2.combine(end, start)]);
          this.addPoints([end, dOrigin]);
          return;
        }
      }
    }


    /* connection via 3 additional lines */
    if (dist.y > 0) {
      if (o.isSouth()) {
        if (Math.abs(dist.x) <= 200) {
          /*
              .--.
              |  *
              |  O
              '--'
           */
          const p = new Vec2([Math.sign(dist.x) * 100 + dist.x, 0]);
          this.addPoints([Vec2.combine(p, start), Vec2.combine(p, end)]);
          this.addPoints([end, dOrigin]);
          return;
        } else {
          /*
              .--.
              *  |  O
                 '--'
           */
          this.addPoints([Vec2.combine(mid, start), Vec2.combine(mid, end)]);
          this.addPoints([end, dOrigin]);
          return;
        }
      }
    }
  }

  public static generatePoints(op, conn): string {
    const svgPolyLine = new SVGPolylineGenerator(op, conn);
    return svgPolyLine.points.reduce((pointStr: string, point: Vec2) => {
      return pointStr + `${point.x},${point.y} `;
    }, '');
  }

  private addPoints(path: Array<Vec2>) {
    path.forEach(p => this.points.push(p.rotate(this.normRot90Deg).translate(this.normTrl)));
  }

  private calcOffset(p: Vec2, padding: Vec2, isOuterPort?: boolean): Vec2 {
    const ori = p.orient();

    let offset;
    if (ori.isNorth()) {
      // to north
      offset = new Vec2([0, -padding.y]);
    } else if (ori.isSouth()) {
      // to south
      offset = new Vec2([0, padding.y]);
    } else if (ori.isWest()) {
      // to west
      offset = new Vec2([-padding.x, 0]);
    } else {
      // to east
      offset = new Vec2([padding.x, 0]);
    }
    return p.plus(offset);
  }
}
