import {EventEmitter, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ApiService} from './api.service';
import {OperatorDef} from '../classes/operator';

@Injectable()
export class OperatorService {

  private localOperators = new Set<OperatorDef>();
  private libraryOperators = new Set<OperatorDef>();
  private elementaryOperators = new Set<OperatorDef>();
  private workingDir: string;
  private loadedEmitter: EventEmitter<boolean>;

  constructor(private api: ApiService) {
    this.loadedEmitter = new EventEmitter<boolean>();
    this.workingDir = localStorage.getItem('workingDir');
    if (this.workingDir === null) {
      this.workingDir = '';
    } else {
      this.refresh();
    }
  }

  public setWorkingDir(workingDir: string) {
    localStorage.setItem('workingDir', workingDir);
    this.workingDir = workingDir;
  }

  public getWorkingDir(): string {
    return this.workingDir;
  }

  public async refresh() {
    const response = await this.api.get('operator/', {cwd: this.workingDir});

    this.localOperators = new Set<OperatorDef>();
    this.libraryOperators = new Set<OperatorDef>();
    this.elementaryOperators = new Set<OperatorDef>();

    if (response['status'] === 'success') {
      for (const operatorData of (response['objects'] as Array<any>)) {
        operatorData.saved = true;
        const operator = new OperatorDef(operatorData);
        switch (operator.getType()) {
          case 'local':
            this.localOperators.add(operator);
            break;
          case 'lib':
            this.libraryOperators.add(operator);
            break;
          case 'elementary':
            this.elementaryOperators.add(operator);
            break;
          default:
          // TODO
        }
      }
      this.loadedEmitter.emit(true);
    } else {
      // TODO
      this.loadedEmitter.emit(false);
    }
  }

  public async storeDefinition(opName: string, def: any): Promise<void> {
    return new Promise<void>(async resolve => {
      await this.api.post('operator/def/', {cwd: this.workingDir, fqop: opName}, def);
      resolve();
    });
  }

  public getLocals(): Set<OperatorDef> {
    return this.localOperators;
  }

  public getLibraries(): Set<OperatorDef> {
    return this.libraryOperators;
  }

  public getElementaries(): Set<OperatorDef> {
    return this.elementaryOperators;
  }

  public addLocal(operator: OperatorDef) {
    this.localOperators.add(operator);
  }

  public getLocal(operatorName: string): OperatorDef {
    return Array.from(this.localOperators.values()).find(op => op.getName() === operatorName);
  }

  public getLibrary(operatorName: string): OperatorDef {
    return Array.from(this.libraryOperators.values()).find(op => op.getName() === operatorName);
  }

  public getElementary(operatorName: string): OperatorDef {
    return Array.from(this.elementaryOperators.values()).find(op => op.getName() === operatorName);
  }

  public getOperator(operatorName: string): OperatorDef {
    let op = this.getLocal(operatorName);
    if (op) {
      return op;
    }
    op = this.getLibrary(operatorName);
    if (op) {
      return op;
    }
    op = this.getElementary(operatorName);
    if (op) {
      return op;
    }
    return null;
  }

  public getLoadingObservable(): Observable<boolean> {
    return this.loadedEmitter;
  }
}
