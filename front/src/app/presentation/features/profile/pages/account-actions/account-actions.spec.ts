import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountActions } from './account-actions';

describe('AccountActions', () => {
  let component: AccountActions;
  let fixture: ComponentFixture<AccountActions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountActions],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountActions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
