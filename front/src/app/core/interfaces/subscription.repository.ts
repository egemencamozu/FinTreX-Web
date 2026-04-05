import { Observable } from 'rxjs';
import { SubscriptionPlan, UserSubscription } from '../models/subscription.model';

export abstract class SubscriptionRepository {
  abstract getAvailablePlans(): Observable<SubscriptionPlan[]>;
  abstract getAdminPlans(): Observable<SubscriptionPlan[]>;
  abstract getMySubscription(): Observable<UserSubscription>;
  abstract upgradePlan(planId: number): Observable<UserSubscription>;
  abstract cancelSubscription(): Observable<void>;
  abstract updateAdminPlan(planId: number, data: any): Observable<SubscriptionPlan>;
}
