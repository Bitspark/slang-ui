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
  public aspect: string;
  @Input()
  public selectedEntity: any = {entity: null};
  @Input()
  public instance: OperatorInstance;

  @Output()
  public selectPort: EventEmitter<any> = new EventEmitter();
  @Output()
  public selectInstance: EventEmitter<any> = new EventEmitter();

  public constructor() {
  }

  public getCSSClass(): any {
    const cssClass = {};
    cssClass['selected'] = this.isSelected();
    cssClass['sl-svg-op-type'] = true;
    cssClass[this.instance.getOperatorType()] = true;
    return cssClass;
  }

  public isSelected() {
    return this.selectedEntity.entity && this.selectedEntity.entity === this.instance;
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

  private abbreviate(str: string): string {
    const maxLength = 15;
    if (str.length < maxLength) {
      return str;
    }
    return str.substr(0, maxLength - 3) + '...';
  }

  public text(): string {
    const fqn = this.instance.getFullyQualifiedName();
    const props = this.instance.getProperties();

    if (fqn === 'slang.const') {
      return !!props ? this.abbreviate(JSON.stringify(props['value'])) : '?';
    } else if (fqn === 'slang.eval') {
      return !!props ? this.abbreviate(props['expression']) : '?';
    }

    return this.abbreviate(this.instance.getName());
  }

  public fqn(): string {
    const fqn = this.instance.getFullyQualifiedName().split('.');
    return fqn[fqn.length - 1];
  }

  public radius(): number {
    return Math.max(this.instance.getWidth(), this.instance.getHeight()) / 2;
  }

}
