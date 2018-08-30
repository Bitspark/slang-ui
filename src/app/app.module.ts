import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {CodemirrorModule} from 'ng2-codemirror';
import {FileUploadModule} from 'ng2-file-upload';

import {AppRoutes} from './app.routes';

import {AppComponent} from './app.component';
import {IndexComponent} from './components/index.component';
import {EditorComponent} from './components/editor.component';
import {OperatorListComponent} from './components/operator-list.component';
import {InstanceComponent} from './components/instance.component';
import {PortComponent} from './components/port.component';
import {ConnectionComponent} from './components/connection.component';
import {TypeDefFormComponent} from './components/type-def-form.component';
import {TypeValueFormComponent} from './components/type-value-form.component';
import {PreviewObjectComponent} from './components/preview-object.component';

import {ApiService} from './services/api.service';
import {OperatorService} from './services/operator.service';
import {VisualService} from './services/visual.service';
import {MouseService} from './services/mouse.service';

import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';


@NgModule({
  declarations: [
    AppComponent, IndexComponent, TypeDefFormComponent, TypeValueFormComponent,
    OperatorListComponent, EditorComponent, InstanceComponent, PortComponent, ConnectionComponent,
    PreviewObjectComponent
  ],
  imports: [
    NgbModule.forRoot(),
    RouterModule.forRoot(
      AppRoutes,
      {enableTracing: false}
    ),
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    CodemirrorModule,
    FileUploadModule
  ],
  providers: [ApiService, OperatorService, VisualService, MouseService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
