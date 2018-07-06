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
    this.x += t.x;
    this.y += t.y;
    return this;
  }

  public rotate(rotBy90deg: number): Vec2 {
    rotBy90deg = (4 + rotBy90deg) % 4;
    let x = this.x;
    let y = this.y;
    // rotation to right
    for (let i = 0; i < rotBy90deg; i++) {
      [x, y] = [-y, x];
    }

    this.x = x;
    this.y = y;
    this.o = new Orientation(this.o.value() + rotBy90deg);

    return this;
  }

  public scale(s: number): Vec2 {
    this.x *= s;
    this.y *= s;
    return this;
  }

  public flip(): Vec2 {
    [this.x, this.y] = [this.y, this.x];
    return this;
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
    const dOrigin = new Vec2(dst.getCenter(),
      dst.getOrientation().rotatedBy((dst.getOperator() === this.outerOperator) ? 2 : 0));
    dOrigin.translate(this.normTrl.neg()).rotate(-this.normRot90Deg);

    const padding = new Vec2([30, 30]);
    const start = this.calcOffset(sOrigin, padding, (src.getParentPort() && src.getParentPort().isMap()) ? src.getPosX() : 0);
    const end = this.calcOffset(dOrigin, padding, (dst.getParentPort() && dst.getParentPort().isMap()) ? dst.getPosX() : 0);
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
        if (Math.abs(dist.x) <= 50) {
          /*
             .---.
             V   |
             O   |
             .---'
             O
           */
          const p = new Vec2([Math.sign(dist.x) * 50, 0]);
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
        if (Math.abs(dist.x) <= 50) {
          /*
             .---.
             O   |
             .---'
             V
             O
           */
          const p = new Vec2([Math.sign(dist.x) * 50, 0]);
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
        if (Math.abs(dist.x) <= 50) {
          /*
             .--.   .--.
             O  |   |  O
             O<-'   `->O
           */
          const p = new Vec2([(o.isWest()) ? -50 : 50, 0]);
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
          if (Math.abs(dist.y) <= 50) {
            const c = end.y - 50;
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
        if (Math.abs(dist.y) <= 50) {
          /*
             .--.   .--.
             O  |   |  O
             O<-'   `->O
           */
          const c = end.y - 50;
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
        if (Math.abs(dist.x) <= 50) {
          /*
              .--.
              |  *
              |  O
              '--'
           */
          const p = new Vec2([Math.sign(dist.x) * 50 + dist.x, 0]);
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

  private static roundOneCorner(p1: [number, number], corner: [number, number], p2: [number, number]):
    { lineEnd: [number, number], curveControl: [number, number], curveEnd: [number, number] } {
    let radius = 25;

    const cornerToP1 = this.lineToVector(corner, p1);
    const cornerToP2 = this.lineToVector(corner, p2);
    const [cornerToP1Unit, mag1] = this.vectorToUnitVector(cornerToP1);
    const [cornerToP2Unit, mag2] = this.vectorToUnitVector(cornerToP2);

    radius = Math.min(radius, mag1 / 2, mag2 / 2);

    const curveP1 = [
      corner[0] + cornerToP1Unit[0] * radius,
      corner[1] + cornerToP1Unit[1] * radius
    ] as [number, number];
    const curveP2 = [
      corner[0] + cornerToP2Unit[0] * radius,
      corner[1] + cornerToP2Unit[1] * radius
    ] as [number, number];
    return {
      lineEnd: curveP1,
      curveControl: corner,
      curveEnd: curveP2
    };
  }

  private static lineToVector(p1: [number, number], p2: [number, number]): [number, number] {
    return [
      p2[0] - p1[0],
      p2[1] - p1[1]
    ];
  }

  private static vectorToUnitVector(v: [number, number]): [[number, number], number] {
    let magnitude = v[0] * v[0] + v[1] * v[1];
    magnitude = Math.sqrt(magnitude);
    return [
      [
        v[0] / magnitude,
        v[1] / magnitude
      ],
      magnitude
    ];
  }

  private static printPath(path) {
    let svgPath = '';
    svgPath += 'L ' + path.lineEnd[0].toFixed(1) + ',' + path.lineEnd[1].toFixed(1) + ' ';
    svgPath += 'Q ' + path.curveControl[0].toFixed(1) + ',' + path.curveControl[1].toFixed(1)
      + ' ' + path.curveEnd[0].toFixed(1) + ',' + path.curveEnd[1].toFixed(1);
    return svgPath;
  }

  public static generatePoints(op: OperatorInstance, conn: Connection): string {
    const svgPolyLine = new SVGPolylineGenerator(op, conn);
    return svgPolyLine.points.reduce((pointStr: string, point: Vec2) => {
      return pointStr + `${point.x},${point.y} `;
    }, '');
  }

  public static generateRoundPoints(op: OperatorInstance, conn: Connection): string {
    const svgPolyLine = new SVGPolylineGenerator(op, conn);
    const points = svgPolyLine.points;
    let svgPath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 0; i + 2 < points.length; i++) {
      const p1 = [points[i].x, points[i].y] as [number, number];
      const p2 = [points[i + 1].x, points[i + 1].y] as [number, number];
      const p3 = [points[i + 2].x, points[i + 2].y] as [number, number];
      svgPath += this.printPath(this.roundOneCorner(p1, p2, p3)) + ' ';
    }
    svgPath += `L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return svgPath;
  }

  private addPoints(path: Array<Vec2>) {
    path.forEach(p => this.points.push(Vec2.copy(p).rotate(this.normRot90Deg).translate(this.normTrl)));
  }

  private calcOffset(p: Vec2, padding: Vec2, margin?: number): Vec2 {
    const ori = p.orient();
    const offsetX = padding.x + margin;
    const offsetY = padding.y + margin;

    let offset;
    if (ori.isNorth()) {
      // to north
      offset = new Vec2([0, -offsetY]);
    } else if (ori.isSouth()) {
      // to south
      offset = new Vec2([0, offsetY]);
    } else if (ori.isWest()) {
      // to west
      offset = new Vec2([-offsetX, 0]);
    } else {
      // to east
      offset = new Vec2([offsetX, 0]);
    }
    return p.plus(offset);
  }
}
