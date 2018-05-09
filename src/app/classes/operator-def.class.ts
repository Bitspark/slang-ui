import {expandProperties} from '../utils';

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
    for (const srvName in def['services']) {
      if (def['services'].hasOwnProperty(srvName)) {
        this.specifyTypeDef(def['services'][srvName]['in'], gens, props, propDefs);
        this.specifyTypeDef(def['services'][srvName]['out'], gens, props, propDefs);
      }
    }
    for (const dlgName in def['delegates']) {
      if (def['delegates'].hasOwnProperty(dlgName)) {
        this.specifyTypeDef(def['delegates'][dlgName]['in'], gens, props, propDefs);
        this.specifyTypeDef(def['delegates'][dlgName]['out'], gens, props, propDefs);
      }
    }
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

  public static calcPortWidth(def: any): number {
    if (this.isPrimitive(def) || def['type'] === 'generic') {
      return 20;
    }
    if (def['type'] === 'stream') {
      return this.calcPortWidth(def['stream']) + 10;
    }
    if (def['type'] === 'map') {
      let width = 0;
      for (const key in def['map']) {
        if (def['map'].hasOwnProperty(key)) {
          width += this.calcPortWidth(def['map'][key]) + 2;
        }
      }
      return width;
    }
    return -1;
  }

  public static calcPortHeight(def: any): number {
    if (this.isPrimitive(def) || def['type'] === 'generic') {
      return 10;
    }
    if (def['type'] === 'stream') {
      return this.calcPortHeight(def['stream']) + 5;
    }
    if (def['type'] === 'map') {
      let height = 0;
      for (const key in def['map']) {
        if (def['map'].hasOwnProperty(key)) {
          height = Math.max(height, this.calcPortHeight(def['map'][key]));
        }
      }
      return height;
    }
    return -1;
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
