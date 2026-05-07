import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PaymentHistoryRepository } from '../../core/interfaces/payment-history.repository';
import { PagedPayments, PaymentTransaction } from '../../core/models/payment-transaction.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({ providedIn: 'root' })
export class PaymentHistoryApiRepository implements PaymentHistoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(EnvironmentConfigService);
  private readonly baseUrl = `${this.config.get('apiBaseUrl')}/v1/Payments`;

  getMyPayments(pageNumber: number, pageSize: number): Observable<PagedPayments> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get<PagedPayments>(`${this.baseUrl}/history`, { params });
  }

  getMyPaymentById(id: number): Observable<PaymentTransaction> {
    return this.http.get<PaymentTransaction>(`${this.baseUrl}/history/${id}`);
  }

  createPortalSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.baseUrl}/create-portal-session`, {});
  }
}
