import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { UserManagementRepository } from '../../core/interfaces/user-management.repository';
import { UserSummary } from '../../core/models/user-summary.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

interface UserManagementActionResponse {
  message?: string;
  Message?: string;
}

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
    return this.http
      .get<UserSummary>(this.meUrl)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error)));
  }

  getAllUsers(): Observable<UserSummary[]> {
    return this.http
      .get<UserSummary[]>(`${this.baseUrl}/users`)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error)));
  }

  getUserById(userId: string): Observable<UserSummary> {
    return this.http
      .get<UserSummary>(`${this.baseUrl}/${userId}`)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error)));
  }

  deactivateUser(userId: string, durationKey: string): Observable<{ message: string }> {
    return this.http
      .post<UserManagementActionResponse>(`${this.baseUrl}/${userId}/deactivate`, { durationKey })
      .pipe(
        map((response) => this.normalizeActionResponse(response, 'Kullanici deactive edildi.')),
        catchError((error: HttpErrorResponse) => this.handleError(error)),
      );
  }

  activateUser(userId: string): Observable<{ message: string }> {
    return this.http.post<UserManagementActionResponse>(`${this.baseUrl}/${userId}/activate`, {}).pipe(
      map((response) => this.normalizeActionResponse(response, 'Kullanici active edildi.')),
      catchError((error: HttpErrorResponse) => this.handleError(error)),
    );
  }

  bulkDeactivate(userIds: string[], durationKey: string): Observable<{ message: string }> {
    return this.http
      .post<UserManagementActionResponse>(`${this.baseUrl}/bulk-deactivate`, { userIds, durationKey })
      .pipe(
        map((response) => this.normalizeActionResponse(response, 'Kullanicilar deactive edildi.')),
        catchError((error: HttpErrorResponse) => this.handleError(error)),
      );
  }

  bulkActivate(userIds: string[]): Observable<{ message: string }> {
    return this.http
      .post<UserManagementActionResponse>(`${this.baseUrl}/bulk-activate`, { userIds })
      .pipe(
        map((response) => this.normalizeActionResponse(response, 'Kullanicilar active edildi.')),
        catchError((error: HttpErrorResponse) => this.handleError(error)),
      );
  }

  private normalizeActionResponse(
    response: UserManagementActionResponse | null | undefined,
    defaultMessage: string,
  ): { message: string } {
    const message = response?.message ?? response?.Message ?? defaultMessage;
    return { message };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 0) {
      return throwError(
        () =>
          new Error(
            'Sunucuya baglanilamadi. Lutfen backend servisinin calistigini ve SSL/CORS ayarlarinin dogru oldugunu kontrol edin.',
          ),
      );
    }

    const serverMessage =
      (typeof error.error === 'string' && error.error) ||
      error.error?.message ||
      error.error?.Message ||
      null;

    if (serverMessage) {
      return throwError(() => new Error(serverMessage));
    }

    return throwError(() => new Error('Kullanici yonetimi istegi basarisiz oldu.'));
  }
}
