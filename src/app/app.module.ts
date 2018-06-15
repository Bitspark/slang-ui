import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {CodemirrorModule} from 'ng2-codemirror';

import {AppRoutes} from './app.routes';

import {AppComponent} from './app.component';
import {IndexComponent} from './components/index.component';
import {OperatorComponent} from './components/operator.component';
import {InstanceComponent} from './components/instance.component';
import {PortComponent} from './components/port.component';
import {TypeDefFormComponent} from './components/type-def-form.component';
import {TypeValueFormComponent} from './components/type-value-form.component';

import {ApiService} from './services/api.service';
import {OperatorService} from './services/operator.service';
import {VisualService} from './services/visual.service';

@NgModule({
  declarations: [
    AppComponent, IndexComponent, OperatorComponent, InstanceComponent, PortComponent, TypeDefFormComponent, TypeValueFormComponent
  ],
  imports: [
    RouterModule.forRoot(
      AppRoutes,
      {enableTracing: true}
    ),
    BrowserModule,
    FormsModule,
    HttpClientModule,
    CodemirrorModule
  ],
  providers: [ApiService, OperatorService, VisualService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
