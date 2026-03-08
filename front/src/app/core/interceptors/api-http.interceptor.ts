import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EnvironmentConfigService } from '../services/environment-config.service';

/**
 * HTTP Interceptor for adding API base URL and handling errors
 * Automatically prepends API_BASE_URL to API requests
 * Adds Authorization header if JWT token is available
 */
@Injectable()
export class ApiHttpInterceptor implements HttpInterceptor {
  private apiBaseUrl: string;
  private jwtTokenKey: string;

  constructor(private envConfig: EnvironmentConfigService) {
    this.apiBaseUrl = this.envConfig.get('apiBaseUrl');
    this.jwtTokenKey = this.envConfig.get('jwtTokenStorageKey');
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Don't modify requests to external URLs (like Stripe, market data APIs)
    if (this.isAbsoluteUrl(request.url)) {
      return next.handle(request).pipe(catchError(this.handleError.bind(this)));
    }

    // Clone request and add API base URL if not already present
    let modifiedRequest = request;
    if (!request.url.startsWith('http')) {
      modifiedRequest = request.clone({
        url: `${this.apiBaseUrl}${request.url.startsWith('/') ? '' : '/'}${request.url}`
      });
    }

    // Add JWT token if available
    const token = this.getStoredToken();
    if (token) {
      modifiedRequest = modifiedRequest.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Add common headers
    modifiedRequest = modifiedRequest.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return next.handle(modifiedRequest).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Check if URL is absolute (external)
   */
  private isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//.test(url);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage =
        (typeof error.error === 'string' && error.error) ||
        error.error?.message ||
        error.error?.Message ||
        error.message ||
        `Error Code: ${error.status}`;

      if (error.status === 401) {
        this.clearStoredAuth();
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found';
      }
    }

    if (this.envConfig.get('debug')) {
      console.error(errorMessage);
    }

    return throwError(() => new Error(errorMessage));
  }

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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.jwtTokenKey);
      localStorage.removeItem(`${this.jwtTokenKey}_user`);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.jwtTokenKey);
      sessionStorage.removeItem(`${this.jwtTokenKey}_user`);
    }
  }
}
