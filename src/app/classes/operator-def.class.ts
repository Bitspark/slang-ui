export class OperatorDef {

  private readonly name: string;
  private readonly def: any;
  private readonly type: string;
  private saved: boolean;

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

  public getType(): string {
    return this.type;
  }

  public isSaved(): boolean {
    return this.saved;
  }

}
