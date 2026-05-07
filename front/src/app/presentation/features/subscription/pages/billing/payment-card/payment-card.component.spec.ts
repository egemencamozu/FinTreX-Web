import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentCardComponent } from './payment-card.component';
import { PaymentStatus } from '../../../../../../core/enums/payment-status.enum';
import { PaymentTransaction } from '../../../../../../core/models/payment-transaction.model';

describe('PaymentCardComponent', () => {
  let component: PaymentCardComponent;
  let fixture: ComponentFixture<PaymentCardComponent>;

  const mockPayment: PaymentTransaction = {
    id: 1,
    stripeInvoiceId: 'in_test',
    invoiceNumber: 'F-0001',
    subscriptionPlanId: 2,
    planDisplayName: 'Premium',
    planTier: null,
    billingPeriod: 'monthly',
    amountPaid: 99,
    amountDue: 99,
    subtotal: 99,
    taxAmount: 0,
    discountAmount: 0,
    refundedAmount: 0,
    currency: 'TRY',
    status: PaymentStatus.PAID,
    periodStartUtc: null,
    periodEndUtc: null,
    paidAtUtc: new Date().toISOString(),
    refundedAtUtc: null,
    createdAtUtc: new Date().toISOString(),
    hostedInvoiceUrl: null,
    receiptUrl: null,
    failureCode: null,
    failureMessage: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentCardComponent);
    fixture.componentRef.setInput('payment', mockPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
