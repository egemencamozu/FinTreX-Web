import { Injectable, Injector } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { EnvironmentConfigService } from '../services/environment-config.service';
import { EmailNotConfirmedError } from '../errors/email-not-confirmed.error';

/**
 * Central HTTP Interceptor — Single Responsibility per concern via private helpers:
 *
 * 1. **Base URL**  — prepends `API_BASE_URL` to relative paths
 * 2. **Auth**      — attaches `Authorization: Bearer <token>` header
 * 3. **Error**     — normalises HTTP errors, clears session on 401
 */
@Injectable()
export class ApiHttpInterceptor implements HttpInterceptor {
  private readonly apiBaseUrl: string;
  private readonly jwtTokenKey: string;

  /**
   * Router is injected lazily via `Injector` to avoid a circular-dependency
   * chain (Router → Guards → AuthService → HttpClient → Interceptor → Router).
   */
  constructor(
    private readonly envConfig: EnvironmentConfigService,
    private readonly injector: Injector,
  ) {
    this.apiBaseUrl = this.envConfig.get('apiBaseUrl');
    this.jwtTokenKey = this.envConfig.get('jwtTokenStorageKey');
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Truly external URLs — skip base-url & auth enrichment
    if (this.isAbsoluteUrl(request.url) && !this.isOwnApiUrl(request.url)) {
      return next.handle(request).pipe(catchError((err) => this.handleError(err)));
    }

    let enriched = this.prependBaseUrl(request);
    enriched = this.attachBearerToken(enriched);
    enriched = this.setDefaultHeaders(enriched);

    return next.handle(enriched).pipe(catchError((err) => this.handleError(err)));
  }

  // ── Base URL ─────────────────────────────────────────────────────────

  private prependBaseUrl(req: HttpRequest<unknown>): HttpRequest<unknown> {
    if (req.url.startsWith('http')) {
      return req;
    }

    const separator = req.url.startsWith('/') ? '' : '/';
    return req.clone({ url: `${this.apiBaseUrl}${separator}${req.url}` });
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  private attachBearerToken(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.getStoredToken();
    if (!token) {
      return req;
    }

    return req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  // ── Headers ───────────────────────────────────────────────────────────

  private setDefaultHeaders(req: HttpRequest<unknown>): HttpRequest<unknown> {
    return req.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ── Error handling ────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Beklenmeyen bir hata oluştu.';

    if (error.error instanceof ErrorEvent) {
      // Client-side / network error
      message = `Hata: ${error.error.message}`;
    } else {
      // Server-side error
      message =
        (typeof error.error === 'string' && error.error) ||
        error.error?.message ||
        error.error?.Message ||
        error.message ||
        `Hata Kodu: ${error.status}`;

      if (error.status === 403 && error.error?.code === 'EMAIL_NOT_CONFIRMED') {
        return throwError(() => new EmailNotConfirmedError(error.error.email ?? '', message));
      }

      switch (error.status) {
        case 401:
          this.clearStoredAuth();
          this.redirectToLogin();
          break;
        case 403:
          message = 'Bu kaynağa erişim yetkiniz bulunmuyor.';
          break;
        case 404:
          message = 'İstenen kaynak bulunamadı.';
          break;
      }
    }

    if (this.envConfig.get('debug')) {
      console.error('[ApiHttpInterceptor]', message, error);
    }

    return throwError(() => new Error(message));
  }

  // ── Token helpers ─────────────────────────────────────────────────────

  private getStoredToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      const localToken = localStorage.getItem(this.jwtTokenKey);
      if (localToken) {
        return localToken;
      }
    }

    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(this.jwtTokenKey);
    }

    return null;
  }

  private clearStoredAuth(): void {
    const userKey = `${this.jwtTokenKey}_user`;

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.jwtTokenKey);
      localStorage.removeItem(userKey);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.jwtTokenKey);
      sessionStorage.removeItem(userKey);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────

  private redirectToLogin(): void {
    // Lazy-resolve Router to avoid circular DI
    const router = this.injector.get(Router);
    void router.navigate(['/auth/login']);
  }

  // ── Utility ───────────────────────────────────────────────────────────

  private isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//.test(url);
  }

  private isOwnApiUrl(url: string): boolean {
    return url.startsWith(this.apiBaseUrl);
  }
}
