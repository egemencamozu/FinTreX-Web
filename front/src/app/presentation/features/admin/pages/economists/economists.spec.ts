import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Economists } from './economists';

describe('Economists', () => {
  let component: Economists;
  let fixture: ComponentFixture<Economists>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Economists],
    }).compileComponents();

    fixture = TestBed.createComponent(Economists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
