import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Consultancy } from './consultancy';

describe('Consultancy', () => {
  let component: Consultancy;
  let fixture: ComponentFixture<Consultancy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Consultancy],
    }).compileComponents();

    fixture = TestBed.createComponent(Consultancy);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
