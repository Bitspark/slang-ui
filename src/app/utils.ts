import {Transformable} from './classes/operator';

function expandExpressionPart(exprPart: string, props: any, propDefs: any): Array<string> {
  const vals = [];
  if (!props) {
    return vals;
  }
  const prop = props[exprPart];
  if (!prop) {
    console.error('missing property', exprPart);
    return null;
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
