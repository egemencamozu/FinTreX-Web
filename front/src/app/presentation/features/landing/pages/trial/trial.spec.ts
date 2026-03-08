import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trial } from './trial';

describe('Trial', () => {
  let component: Trial;
  let fixture: ComponentFixture<Trial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trial]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Trial);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
