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
}
