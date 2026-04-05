import { Observable } from 'rxjs';

export abstract class PaymentService {
  abstract processUpgrade(userId: string, planId: number): Observable<{ success: boolean; message: string }>;
  abstract cancelSubscription(subscriptionId: number): Observable<{ success: boolean; message: string }>;
}
