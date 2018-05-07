import {Injectable} from '@angular/core';
import {Observable, Observer} from 'rxjs';
import {ApiService} from './api.service';
import {OperatorDef} from '../classes/operator-def.class';

@Injectable()
export class OperatorService {

  private localOperators: Array<OperatorDef> = [];
  private libraryOperators: Array<OperatorDef> = [];
  private elementaryOperators: Array<OperatorDef> = [];
  private workingDir: string;
  private readonly loadingObservable: Observable<boolean>;
  private loadingObserver: Observer<boolean>;

  constructor(private api: ApiService) {
    this.loadingObservable = new Observable<boolean>(observer => this.loadingObserver = observer);
    this.workingDir = localStorage.getItem('workingDir');
    if (this.workingDir === null) {
      this.workingDir = '';
    } else {
      this.refresh();
    }
  }

  public setWorkingDir(workingDir: string) {
    localStorage.setItem('workingDir', this.workingDir);
    this.workingDir = workingDir;
  }

  public getWorkingDir(): string {
    return this.workingDir;
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
      this.loadingObserver.next(true);
    } else {
      // TODO
      this.loadingObserver.next(false);
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

  public getLoadingObservable(): Observable<boolean> {
    return this.loadingObservable;
  }

}
