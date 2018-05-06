import {Injectable} from '@angular/core';
import {ApiService} from './api.service';
import {OperatorDef} from '../classes/operator-def.class';

@Injectable()
export class OperatorService {

  private localOperators: Array<OperatorDef> = [];
  private libraryOperators: Array<OperatorDef> = [];
  private elementaryOperators: Array<OperatorDef> = [];

  constructor(private api: ApiService) {
  }

  public async refresh(workingDir: string) {
    const response = await this.api.get('operator/', {workingDir: workingDir});

    if (response['status'] === 'success') {
      for (const operatorData of (response['objects'] as Array<any>)) {
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

}
