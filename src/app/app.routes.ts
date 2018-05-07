import {Routes} from '@angular/router';
import {IndexComponent} from './components/index.component';
import {OperatorComponent} from './components/operator.component';

export const AppRoutes: Routes = [
  {path: '', component: IndexComponent},
  {path: 'operator/:operatorName', component: OperatorComponent}
];
