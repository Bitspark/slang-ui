import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

import {AppRoutes} from './app.routes';

import {AppComponent} from './app.component';
import {IndexComponent} from './components/index.component';

import {ApiService} from './services/api.service';
import {OperatorService} from './services/operator.service';

@NgModule({
  declarations: [
    AppComponent, IndexComponent
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
  providers: [ApiService, OperatorService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
