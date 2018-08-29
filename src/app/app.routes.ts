import {Routes} from '@angular/router';
import {IndexComponent} from './components/index.component';
import {EditorComponent} from './components/editor.component';

export const AppRoutes: Routes = [
  {path: '', component: IndexComponent},
  {path: 'operator/:operatorName', component: EditorComponent}
];
