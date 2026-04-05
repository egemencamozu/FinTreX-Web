import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyEconomist } from './my-economist';

describe('MyEconomist', () => {
  let component: MyEconomist;
  let fixture: ComponentFixture<MyEconomist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyEconomist],
    }).compileComponents();

    fixture = TestBed.createComponent(MyEconomist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
