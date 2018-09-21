import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';

import 'codemirror/mode/python/python.js';
import 'codemirror/mode/javascript/javascript.js';

@Component({
  templateUrl: './bridge-code.component.html',
  styleUrls: ['./bridge-code.component.scss']
})
export class BridgeCodeComponent implements OnInit {

  @Input()
  public language: string;

  public source_: string;

  @Input()
  public set source(source: string) {
    this.source_ = source;
  }

  public get source(): string {
    return this.source_;
  }

  @Output()
  public sourceChange = new EventEmitter<string>();

  public editorConfig: any;

  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit(): void {
    const modes = {
      python: 'text/x-python',
      javascript: 'text/javascript'
    };

    this.editorConfig = {
      theme: 'slang-dark',
      mode: modes[this.language],
      lineNumbers: true
    };

    console.log(JSON.stringify(this.editorConfig));
  }

  public save() {
    this.sourceChange.emit(this.source);
  }

}
