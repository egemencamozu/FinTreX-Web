import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AdminRevenueDashboardRepository } from '../../core/interfaces/admin-revenue-dashboard.repository';
import {
  AdminDashboardSummary,
  AdminDashboardTrends,
  AdminDashboardStripeLive,
} from '../../core/models/admin-revenue-dashboard.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({ providedIn: 'root' })
export class AdminRevenueDashboardApiRepository extends AdminRevenueDashboardRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(EnvironmentConfigService);
  private readonly baseUrl = `${this.config.get('apiBaseUrl')}/v1/Payments/admin/dashboard`;

  getSummary(): Observable<AdminDashboardSummary> {
    return this.http.get<AdminDashboardSummary>(`${this.baseUrl}/summary`);
  }

  getTrends(): Observable<AdminDashboardTrends> {
    return this.http.get<AdminDashboardTrends>(`${this.baseUrl}/trends`);
  }

  getStripeLive(): Observable<AdminDashboardStripeLive> {
    return this.http.get<AdminDashboardStripeLive>(`${this.baseUrl}/stripe-live`);
  }
}
