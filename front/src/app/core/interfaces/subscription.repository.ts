import { Observable } from 'rxjs';
import { SubscriptionPlan, UserSubscription } from '../models/subscription.model';

export type BillingPeriod = 'monthly' | 'yearly';

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export abstract class SubscriptionRepository {
  abstract getAvailablePlans(): Observable<SubscriptionPlan[]>;
  abstract getAdminPlans(): Observable<SubscriptionPlan[]>;
  abstract getMySubscription(): Observable<UserSubscription>;
  abstract upgradePlan(planId: number): Observable<UserSubscription>;
  abstract cancelSubscription(): Observable<void>;
  abstract updateAdminPlan(planId: number, data: any): Observable<SubscriptionPlan>;

  // Stripe Checkout (hosted) flow
  abstract createCheckoutSession(planId: number, billingPeriod: BillingPeriod): Observable<CheckoutSessionResult>;
  abstract createPortalSession(): Observable<{ url: string }>;
  abstract verifyCheckoutSession(sessionId: string): Observable<UserSubscription>;
}
