export class OperatorDef {

  private readonly name: string;
  private readonly def: any;
  private readonly type: string;

  constructor({name, def, type}) {
    this.name = name;
    this.def = def;
    this.type = type;
  }

  public getName(): string {
    return this.name;
  }

  public getDef(): any {
    return this.def;
  }

  public getType(): string {
    return this.type;
  }

}
