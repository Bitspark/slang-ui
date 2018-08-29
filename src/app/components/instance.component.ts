import {Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef, ChangeDetectionStrategy} from '@angular/core';
import {OperatorInstance, Transformable} from '../classes/operator';
import {generateSvgTransform} from '../utils';

@Component({
  selector: 'app-instance,[app-instance]',
  templateUrl: './instance.component.svg.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.Default
})
export class InstanceComponent implements OnInit {
  @Input()
  public aspect: string;
  @Input()
  public selectedEntity: any = {entity: null};
  @Input()
  public instance: OperatorInstance;

  private fqn = '';

  @Output()
  public hoverPort: EventEmitter<any> = new EventEmitter();
  @Output()
  public selectPort: EventEmitter<any> = new EventEmitter();
  @Output()
  public selectInstance: EventEmitter<any> = new EventEmitter();

  public constructor(private cd: ChangeDetectorRef) {
  }

  public getCSSClass(): any {
    const cssClass = {};
    cssClass['selected'] = this.isSelected();
    cssClass['sl-svg-op-type'] = true;
    cssClass[this.instance.getOperatorType()] = true;
    return cssClass;
  }

  public ngOnInit() {
    this.fqn = this.instance.getFullyQualifiedName();
  }

  public isSelected() {
    return this.selectedEntity.entity && this.selectedEntity.entity === this.instance;
  }

  public transform(trans: Transformable): string {
    return generateSvgTransform(trans);
  }

  public form(): string {
    switch (this.fqn) {
      case 'slang.data.Value':
        return 'circle';
      default:
        return 'rect';
    }
  }

  private abbreviate(str: string): string {
    const maxLength = 15;
    if (str.length < maxLength) {
      return str;
    }
    return str.substr(0, maxLength - 3) + '...';
  }

  public radius(): number {
    return Math.max(this.instance.getWidth(), this.instance.getHeight()) / 2;
  }

}
