import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminStatsRepository } from '../../core/interfaces/admin-stats.repository';
import { AdminStats } from '../../core/models/admin-stats.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminStatsApiRepository extends AdminStatsRepository {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/v1/usermanagement/stats`;

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(this.apiUrl);
  }
}
