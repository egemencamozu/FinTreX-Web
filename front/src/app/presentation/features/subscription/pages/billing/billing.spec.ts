import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Billing } from './billing';
import { PaymentHistoryRepository } from '../../../../../core/interfaces/payment-history.repository';

describe('Billing', () => {
  let component: Billing;
  let fixture: ComponentFixture<Billing>;

  const repoStub: Partial<PaymentHistoryRepository> = {
    getMyPayments: () => of({ pageNumber: 1, pageSize: 10, totalCount: 0, data: [] }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Billing],
      providers: [
        { provide: PaymentHistoryRepository, useValue: repoStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Billing);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
