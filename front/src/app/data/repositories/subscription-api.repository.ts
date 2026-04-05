import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { SubscriptionRepository } from '../../core/interfaces/subscription.repository';
import { SubscriptionPlan, UserSubscription } from '../../core/models/subscription.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionApiRepository implements SubscriptionRepository {
  private readonly baseUrl: string;

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
    // Admin routes use the specialized admin prefix in backend
    return this.http.get<SubscriptionPlan[]>(`${this.configService.get('apiBaseUrl')}/v1/admin/subscription-plans`);
  }

  getMySubscription(): Observable<UserSubscription> {
    return this.http.get<UserSubscription>(`${this.baseUrl}/my-subscription`);
  }

  upgradePlan(planId: number): Observable<UserSubscription> {
    // Calling POST /api/v1/Subscriptions/upgrade/{planId}
    return this.http.post<UserSubscription>(`${this.baseUrl}/upgrade/${planId}`, {});
  }

  cancelSubscription(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cancel`, {});
  }

  updateAdminPlan(planId: number, data: any): Observable<SubscriptionPlan> {
    return this.http.put<SubscriptionPlan>(`${this.configService.get('apiBaseUrl')}/v1/admin/subscription-plans/${planId}`, data);
  }
}
