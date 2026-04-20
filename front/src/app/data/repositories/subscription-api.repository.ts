import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BillingPeriod,
  CheckoutSessionResult,
  SubscriptionRepository,
} from '../../core/interfaces/subscription.repository';
import { SubscriptionPlan, UserSubscription } from '../../core/models/subscription.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionApiRepository implements SubscriptionRepository {
  private readonly baseUrl: string;
  private readonly paymentsUrl = '/v1/payments';

  constructor(
    private readonly http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    this.baseUrl = `${this.configService.get('apiBaseUrl')}/v1/Subscriptions`;
  }

  getAvailablePlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<SubscriptionPlan[]>(`${this.baseUrl}/plans`);
  }

  getAdminPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<SubscriptionPlan[]>(`${this.configService.get('apiBaseUrl')}/v1/admin/subscription-plans`);
  }

  getMySubscription(): Observable<UserSubscription> {
    return this.http.get<UserSubscription>(`${this.baseUrl}/my-subscription`);
  }

  upgradePlan(planId: number): Observable<UserSubscription> {
    return this.http.post<UserSubscription>(`${this.baseUrl}/upgrade/${planId}`, {});
  }

  cancelSubscription(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cancel`, {});
  }

  updateAdminPlan(planId: number, data: any): Observable<SubscriptionPlan> {
    return this.http.put<SubscriptionPlan>(`${this.configService.get('apiBaseUrl')}/v1/admin/subscription-plans/${planId}`, data);
  }

  createCheckoutSession(planId: number, billingPeriod: BillingPeriod): Observable<CheckoutSessionResult> {
    return this.http.post<CheckoutSessionResult>(`${this.configService.get('apiBaseUrl')}${this.paymentsUrl}/create-checkout-session`, {
      planId,
      billingPeriod,
    });
  }

  createPortalSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.configService.get('apiBaseUrl')}${this.paymentsUrl}/create-portal-session`, {});
  }

  verifyCheckoutSession(sessionId: string): Observable<UserSubscription> {
    return this.http.get<UserSubscription>(`${this.configService.get('apiBaseUrl')}${this.paymentsUrl}/verify-session/${sessionId}`);
  }
}
