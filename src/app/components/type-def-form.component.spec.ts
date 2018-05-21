import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TypeDefFormComponent } from './type-def-form.component';

describe('TypeDefFormComponent', () => {
  let component: TypeDefFormComponent;
  let fixture: ComponentFixture<TypeDefFormComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TypeDefFormComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TypeDefFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
