import { Observable } from 'rxjs';
import { PagedPayments, PaymentTransaction } from '../models/payment-transaction.model';

export abstract class PaymentHistoryRepository {
  abstract getMyPayments(pageNumber: number, pageSize: number): Observable<PagedPayments>;
  abstract getMyPaymentById(id: number): Observable<PaymentTransaction>;
  abstract createPortalSession(): Observable<{ url: string }>;
}
