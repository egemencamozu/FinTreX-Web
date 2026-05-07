import { PaymentStatus } from '../enums/payment-status.enum';
import { SubscriptionTier } from '../enums/subscription-tier.enum';

export interface PaymentTransaction {
  id: number;

  stripeInvoiceId: string;
  invoiceNumber: string | null;

  subscriptionPlanId: number | null;
  planDisplayName: string | null;
  planTier: SubscriptionTier | null;

  billingPeriod: string | null;

  amountPaid: number;
  amountDue: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  refundedAmount: number;
  currency: string;

  status: PaymentStatus;

  periodStartUtc: string | null;
  periodEndUtc: string | null;
  paidAtUtc: string | null;
  refundedAtUtc: string | null;
  createdAtUtc: string;

  hostedInvoiceUrl: string | null;
  receiptUrl: string | null;

  failureCode: string | null;
  failureMessage: string | null;
}

export interface PagedPayments {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  data: PaymentTransaction[];
}
