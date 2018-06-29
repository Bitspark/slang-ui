import {Connection, OperatorDef, OperatorInstance, Port, Transformable} from './classes/operator';

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

export class SVGPolylineGenerator {
  private points: Array<Array<number>> = [];

  private constructor(private outerOperator, private conn: Connection) {
    const s = conn.getSource();
    const d = conn.getDestination();
    const src: [number, number] = [s.getPortPosX(), s.getPortPosY()];
    const dst: [number, number] = [d.getPortPosX(), d.getPortPosY()];
    let dist = this.getDistance(src, dst);
    const srcOffset = this.getOffsetPoint(s, dist);
    const dstOffset = this.getOffsetPoint(d, dist);
    const start: [number, number] = [src[0] + srcOffset[0], src[1] + srcOffset[1]];
    const end: [number, number] = [dst[0] + dstOffset[0], dst[1] + dstOffset[1]];
    dist = this.getDistance(start, end);
    const p = (s.getParentPort() && s.getParentPort().isMap()) ? s.getPosX() : 0;
    const mid = [
      (start[0] + (end[0] - start[0]) / 2) + p,
      (start[1] + (end[1] - start[1]) / 2) + p,
    ];

    /*********
     *
     *  IMPLEMENT ORIENTATION ABSTRACTION
     *
     */

    const sOri = s.getOrientation();
    const dOri = d.getOrientation();

    const [toN, toW, toS, toE] = [0, 1, 2, 3];

    this.points.push(src);

    if (sOri === dOri) {
      if (sOri === toN || sOri === toS) {
        this.points.push(start, [end[0], start[1]], end);
      } else {
        this.points.push(start, [end[0], start[1]], end);
      }
    } else if (sOri === toS && dOri === toN) {
      if (dist[1] < 0) {
        this.points.push(start, [mid[0], start[1]], [mid[0], end[1]], end);
      } else {
        this.points.push(start, [end[0], start[1]], end);
      }
    } else if ((sOri + 1) % 4 === dOri) {
      // direction from source to destination
      let normDistX, normDistY;
      switch (sOri) {
        case toE:
          normDistX = dist[0];
          normDistY = dist[1];
          break;
        case toS:
          normDistX = -dist[1];
          normDistY = dist[0];
          break;
      }

      this.points.push(start);

      if (normDistX > 0) {
        if (normDistY > 0) {
          // south-east
          this.points.push([end[0], start[1]]);
        } else {
          // north-east
          this.points.push([mid[0], start[1]], [mid[0], end[1]]);
        }
      } else {
        if (normDistY > 0) {
          // south-west
          this.points.push([start[0], mid[1]], [end[0], mid[1]]);
        } else {
          // north-west
          this.points.push([start[0], end[1]], [end[0], end[1]]);
        }
      }

      this.points.push(end);
    }

    this.points.push(dst);
  }


  public static generatePoints(op, conn): string {
    return new SVGPolylineGenerator(op, conn).points.reduce((pointStr: string, point: [number, number]) => {
      return pointStr + `${point[0]},${point[1]} `;
    }, '');
  }

  private getDistance(src: [number, number], dst: [number, number]): [number, number] {
    return [
      dst[0] - src[0],
      dst[1] - src[1],
    ];
  }

  private calcOffset(dist: number): number {
    return Math.max(3 * Math.sqrt(Math.abs(dist)), 10);
  }

  private getOffsetPoint(p: Port, distance): [number, number] {
    let ori = p.getOrientation();
    if (p.getOperator() === this.outerOperator) {
      ori = (ori + 2) % 4;
    }

    const padding = (p.getParentPort() && p.getParentPort().isMap()) ? p.getPosX() : 0;
    const offset = [this.calcOffset(distance[0]), this.calcOffset(distance[1])];

    if (ori === 0) {
      // to north
      return [0, -offset[1]];
    } else if (ori === 1) {
      // to west
      return [-offset[0] + padding, 0];
    } else if (ori === 3) {
      // to east
      return [offset[0], 0];
    } else {
      // to south
      return [0, offset[1] + padding];
    }
  }
}
