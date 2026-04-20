import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';
import { SubscriptionTier } from '../enums/subscription-tier.enum';
import { UserRole } from '../enums/user-role.enum';
import { EnvironmentConfigService } from './environment-config.service';
import { UserManagementRepository } from '../interfaces/user-management.repository';
import { UserSummary } from '../models/user-summary.model';
import { VerifyEmailRequest } from '../models/auth/verify-email-request.model';
import { ResendVerificationRequest } from '../models/auth/resend-verification-request.model';
import { RegisterResponse } from '../models/auth/register-response.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

interface AuthenticationResponse {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  isVerified: boolean;
  jwToken: string;
  refreshToken: string;
  refreshTokenExpiration: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  role: UserRole;
  phoneNumber?: string;
  subscriptionTier: SubscriptionTier;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authApiUrl: string;
  private readonly tokenStorageKey: string;
  private readonly userStorageKey: string;
  private readonly refreshTokenKey: string;
  private readonly currentUserSubject: BehaviorSubject<AuthenticatedUser | null>;

  readonly currentUser$: Observable<AuthenticatedUser | null>;

  constructor(
    private readonly http: HttpClient,
    private readonly envConfig: EnvironmentConfigService,
    private readonly userManagementRepository: UserManagementRepository,
  ) {
    this.authApiUrl = this.envConfig.get('authApiUrl');
    this.tokenStorageKey = this.envConfig.get('jwtTokenStorageKey');
    this.userStorageKey = `${this.tokenStorageKey}_user`;
    this.refreshTokenKey = `${this.tokenStorageKey}_refresh`;
    this.currentUserSubject = new BehaviorSubject<AuthenticatedUser | null>(this.readStoredUser());
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  // ── Auth Operations ──────────────────────────────────────────────────

  login(request: LoginRequest, rememberMe: boolean): Observable<AuthenticatedUser> {
    return this.http.post<AuthenticationResponse>(`${this.authApiUrl}/authenticate`, request).pipe(
      tap((response) => this.persistAuthentication(response, rememberMe)),
      switchMap(() => this.syncCurrentUserProfile(rememberMe)),
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.authApiUrl}/register`, request);
  }

  /**
   * Submit the 6-digit email verification code. On success, backend returns
   * a fully-authenticated response (JWT + refresh token). Session storage is
   * used by default — caller passes rememberMe if applicable.
   */
  verifyEmail(
    request: VerifyEmailRequest,
    rememberMe = false,
  ): Observable<AuthenticatedUser> {
    return this.http
      .post<AuthenticationResponse>(`${this.authApiUrl}/verify-email`, request)
      .pipe(
        tap((response) => this.persistAuthentication(response, rememberMe)),
        switchMap(() => this.syncCurrentUserProfile(rememberMe)),
      );
  }

  /** Request a new OTP code. Backend enforces a 60-second cooldown. */
  resendVerificationCode(email: string): Observable<{ message: string }> {
    const payload: ResendVerificationRequest = { email };
    return this.http.post<{ message: string }>(
      `${this.authApiUrl}/resend-verification-code`,
      payload,
    );
  }

  logout(): void {
    const refreshToken = this.readStoredValue(this.refreshTokenKey);
    if (refreshToken) {
      // Best-effort revoke — don't block logout on failure
      this.http
        .post(`${this.authApiUrl}/revoke-token`, { token: refreshToken })
        .subscribe({ error: () => {} });
    }
    this.clearStoredAuth();
    this.currentUserSubject.next(null);
  }

  /**
   * Exchange the stored refresh token for a new JWT + refresh token pair.
   * Called by the interceptor when a 401 is received.
   */
  refreshToken(): Observable<AuthenticatedUser> {
    const token = this.readStoredValue(this.refreshTokenKey);
    if (!token) {
      this.logout();
      throw new Error('No refresh token available.');
    }

    const rememberMe = this.isRememberMeSession();

    return this.http
      .post<AuthenticationResponse>(`${this.authApiUrl}/refresh-token`, { token })
      .pipe(
        tap((response) => this.persistAuthentication(response, rememberMe)),
        switchMap(() => this.syncCurrentUserProfile(rememberMe)),
      );
  }

  // ── Password Operations ──────────────────────────────────────────────

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authApiUrl}/forgot-password`, { email });
  }

  resetPassword(
    email: string,
    token: string,
    password: string,
    confirmPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authApiUrl}/reset-password`, {
      email,
      token,
      password,
      confirmPassword,
    });
  }

  // ── State Queries ────────────────────────────────────────────────────

  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.getAccessToken();
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }
    if (this.isTokenExpired(token)) {
      // Don't logout immediately — let the interceptor try refresh first
      return false;
    }
    return true;
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserSubject.value?.role === role;
  }

  getRedirectUrl(): string {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      throw new Error('Authenticated user context is missing.');
    }

    if (this.hasRole(UserRole.ADMIN)) return '/app/admin/users';
    if (this.hasRole(UserRole.ECONOMIST)) return '/app/economist';
    if (this.hasRole(UserRole.USER)) return '/app/user';

    throw new Error(`Unsupported role '${currentUser.role}'.`);
  }

  /** Check if a stored refresh token exists. */
  hasRefreshToken(): boolean {
    return !!this.readStoredValue(this.refreshTokenKey);
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private persistAuthentication(response: AuthenticationResponse, rememberMe: boolean): void {
    const user = this.mapAuthenticationResponse(response);
    const storage = this.getWritableStorage(rememberMe);

    this.clearStoredAuth();

    storage?.setItem(this.tokenStorageKey, response.jwToken);
    storage?.setItem(this.userStorageKey, JSON.stringify(user));
    if (response.refreshToken) {
      storage?.setItem(this.refreshTokenKey, response.refreshToken);
    }

    this.currentUserSubject.next(user);
  }

  private mapAuthenticationResponse(response: AuthenticationResponse): AuthenticatedUser {
    const role = this.normalizeRole(response.role);

    return {
      id: response.id,
      email: response.email,
      firstName: response.firstName ?? '',
      lastName: response.lastName ?? '',
      userName: response.userName,
      role,
      phoneNumber: response.phoneNumber,
      subscriptionTier: SubscriptionTier.Default,
    };
  }

  private mapUserSummaryResponse(response: UserSummary): AuthenticatedUser {
    const role = this.normalizeRole(response.role);

    return {
      id: response.id,
      email: response.email,
      firstName: response.firstName ?? '',
      lastName: response.lastName ?? '',
      userName: response.userName,
      role,
      phoneNumber: response.phoneNumber,
      subscriptionTier: SubscriptionTier.Default,
    };
  }

  private syncCurrentUserProfile(rememberMe: boolean): Observable<AuthenticatedUser> {
    return this.userManagementRepository.getMyProfile().pipe(
      map((profile) => {
        const user = this.mapUserSummaryResponse(profile);
        this.persistCurrentUser(user, rememberMe);
        return user;
      }),
      catchError((error: Error) => {
        this.clearStoredAuth();
        this.currentUserSubject.next(null);
        return throwError(() => error);
      }),
    );
  }

  private persistCurrentUser(user: AuthenticatedUser, rememberMe: boolean): void {
    const storage = this.getWritableStorage(rememberMe);
    if (!storage) {
      return;
    }

    storage.setItem(this.userStorageKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private normalizeRole(rawRole: string | null | undefined): UserRole {
    switch ((rawRole ?? '').trim().toUpperCase()) {
      case 'ADMIN':
      case 'SUPERADMIN':
        return UserRole.ADMIN;
      case 'ECONOMIST':
      case 'MODERATOR':
        return UserRole.ECONOMIST;
      case 'USER':
      case 'BASIC':
        return UserRole.USER;
      case '':
        throw new Error('Authentication response contains an empty role value.');
      default:
        throw new Error(`Authentication response contains an unsupported role '${rawRole}'.`);
    }
  }

  private readStoredUser(): AuthenticatedUser | null {
    const userJson = this.readStoredValue(this.userStorageKey);
    const token = this.readStoredValue(this.tokenStorageKey);

    if (!userJson || !token || this.isTokenExpired(token)) {
      this.clearStoredAuth();
      return null;
    }

    try {
      return JSON.parse(userJson) as AuthenticatedUser;
    } catch {
      this.clearStoredAuth();
      return null;
    }
  }

  private getAccessToken(): string | null {
    return this.readStoredValue(this.tokenStorageKey);
  }

  private readStoredValue(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      const localValue = localStorage.getItem(key);
      if (localValue) {
        return localValue;
      }
    }

    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }

    return null;
  }

  private clearStoredAuth(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenStorageKey);
      localStorage.removeItem(this.userStorageKey);
      localStorage.removeItem(this.refreshTokenKey);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.tokenStorageKey);
      sessionStorage.removeItem(this.userStorageKey);
      sessionStorage.removeItem(this.refreshTokenKey);
    }
  }

  private getWritableStorage(rememberMe: boolean): Storage | null {
    if (rememberMe && typeof localStorage !== 'undefined') {
      return localStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  }

  private isRememberMeSession(): boolean {
    return (
      typeof localStorage !== 'undefined' && localStorage.getItem(this.tokenStorageKey) !== null
    );
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    const expiration = typeof payload?.['exp'] === 'number' ? payload['exp'] * 1000 : null;
    if (!expiration) {
      return false;
    }
    return Date.now() >= expiration;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3 || typeof atob === 'undefined') {
      return null;
    }

    try {
      const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = atob(
        normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='),
      );
      return JSON.parse(decodedPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
