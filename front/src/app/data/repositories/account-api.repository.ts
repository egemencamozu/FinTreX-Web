import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountRepository } from '../../core/interfaces/account.repository';
import { ChangePasswordRequest, Session } from '../../core/models/session.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root',
})
export class AccountApiRepository extends AccountRepository {
  private readonly authApiUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: EnvironmentConfigService,
  ) {
    super();
    this.authApiUrl = this.configService.get('authApiUrl');
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.authApiUrl}/change-password`,
      request,
    );
  }

  getSessions(): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.authApiUrl}/sessions`);
  }

  revokeSession(sessionId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.authApiUrl}/sessions/${sessionId}`,
    );
  }

  revokeOtherSessions(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.authApiUrl}/sessions/revoke-others`,
      {},
    );
  }
}
