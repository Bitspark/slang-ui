import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

import {AppRoutes} from './app.routes';

import {AppComponent} from './app.component';
import {IndexComponent} from './components/index.component';
import {OperatorComponent} from './components/operator.component';
import {PortComponent} from './components/port.component';

import {ApiService} from './services/api.service';
import {OperatorService} from './services/operator.service';
import {VisualService} from './services/visual.service';

@NgModule({
  declarations: [
    AppComponent, IndexComponent, OperatorComponent, PortComponent
  ],
  imports: [
    RouterModule.forRoot(
      AppRoutes,
      {enableTracing: true}
    ),
    BrowserModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [ApiService, OperatorService, VisualService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
