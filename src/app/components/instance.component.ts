import {Component, EventEmitter, Input, Output} from '@angular/core';
import {OperatorInstance, Transformable} from '../classes/operator';
import {generateSvgTransform} from '../utils';

@Component({
  selector: 'app-instance,[app-instance]',
  templateUrl: './instance.component.svg.html',
  styleUrls: []
})
export class InstanceComponent {
  @Input()
  public selectedEntity: any = { entity: null };
  @Input()
  public instance: OperatorInstance;

  @Output()
  public selectPort: EventEmitter<any> = new EventEmitter();
  @Output()
  public selectInstance: EventEmitter<any> = new EventEmitter();

  public constructor() {
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public form(): string {
    const fqn = this.instance.getFullyQualifiedName();
    if (fqn === 'slang.const') {
      return 'circle';
    }
    return 'rect';
  }

  public color(): string {
    switch (this.instance.getOperatorType()) {
      case 'local':
        return '#33cc33';
      case 'library':
        return '#ff9933';
      case 'elementary':
        return '#6699ff';
    }
  }

  public text(): string {
    const fqn = this.instance.getFullyQualifiedName();
    const props = this.instance.getProperties();

    if (fqn === 'slang.const') {
      return JSON.stringify(props['value']);
    } else if (fqn === 'slang.eval') {
      return props['expression'];
    }

    return this.instance.getName();
  }

  public fqn(): string {
    const fqn = this.instance.getFullyQualifiedName().split('.');
    return fqn[fqn.length - 1];
  }

  public radius(): number {
    return Math.max(this.instance.getWidth(), this.instance.getHeight()) / 2;
  }

}
