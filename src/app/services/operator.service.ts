import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {OperatorDef} from '../classes/operator-def.class';

@Injectable()
export class OperatorService {

  private localOperators: Array<OperatorDef> = [];
  private libraryOperators: Array<OperatorDef> = [];
  private elementaryOperators: Array<OperatorDef> = [];
  private workingDir: string;

  constructor(private api: ApiService) {
  }

  public setWorkingDir(workingDir: string) {
    this.workingDir = workingDir;
  }

  public async refresh() {
    const response = await this.api.get('operator/', {cwd: this.workingDir});

    this.localOperators = [];
    this.libraryOperators = [];
    this.elementaryOperators = [];

    if (response['status'] === 'success') {
      for (const operatorData of (response['objects'] as Array<any>)) {
        operatorData.saved = true;
        const operator = new OperatorDef(operatorData);
        switch (operator.getType()) {
          case 'local':
            this.localOperators.push(operator);
            break;
          case 'lib':
            this.libraryOperators.push(operator);
            break;
          case 'elementary':
            this.elementaryOperators.push(operator);
            break;
          default:
            // TODO
        }
      }
    } else {
      // TODO
    }
  }

  public getLocals(): Array<OperatorDef> {
    return this.localOperators;
  }

  public getLibraries(): Array<OperatorDef> {
    return this.libraryOperators;
  }

  public getElementaries(): Array<OperatorDef> {
    return this.elementaryOperators;
  }

  public addLocal(operator: OperatorDef) {
    this.localOperators.push(operator);
  }

  public getLocal(operatorName: string): OperatorDef {
    return this.localOperators.find(op => op.getName() === operatorName);
  }

}
