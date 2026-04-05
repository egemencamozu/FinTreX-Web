import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserManagementRepository } from '../../core/interfaces/user-management.repository';
import { UserSummary } from '../../core/models/user-summary.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root',
})
export class UserManagementApiRepository extends UserManagementRepository {
  private readonly baseUrl: string;
  private readonly meUrl: string;

  constructor(
    private readonly http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    super();
    const apiBase = this.configService.get('apiBaseUrl');
    this.baseUrl = `${apiBase}/v1/UserManagement`;
    this.meUrl = `${this.baseUrl}/me`;
  }

  getMyProfile(): Observable<UserSummary> {
    return this.http.get<UserSummary>(this.meUrl);
  }

  getAllUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.baseUrl}/users`);
  }

  getUserById(userId: string): Observable<UserSummary> {
    return this.http.get<UserSummary>(`${this.baseUrl}/${userId}`);
  }

  deactivateUser(userId: string, durationKey: string): Observable<{ message: string }> {
    // Current controller uses a generic deactivate without duration, mapping to simple POST
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/${userId}/deactivate`,
      {}
    );
  }

  activateUser(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/${userId}/activate`,
      {}
    );
  }
}
