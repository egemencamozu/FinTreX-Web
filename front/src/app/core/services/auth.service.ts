import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { SubscriptionTier } from '../enums/subscription-tier.enum';
import { UserRole } from '../enums/user-role.enum';
import { EnvironmentConfigService } from './environment-config.service';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
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
  roles: string[];
  isVerified: boolean;
  jwToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  role: UserRole;
  roles: UserRole[];
  subscriptionTier: SubscriptionTier;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authApiUrl: string;
  private readonly tokenStorageKey: string;
  private readonly userStorageKey: string;
  private readonly currentUserSubject: BehaviorSubject<AuthenticatedUser | null>;

  readonly currentUser$: Observable<AuthenticatedUser | null>;

  constructor(
    private readonly http: HttpClient,
    private readonly envConfig: EnvironmentConfigService,
  ) {
    this.authApiUrl = this.envConfig.get('authApiUrl');
    this.tokenStorageKey = this.envConfig.get('jwtTokenStorageKey');
    this.userStorageKey = `${this.tokenStorageKey}_user`;
    this.currentUserSubject = new BehaviorSubject<AuthenticatedUser | null>(this.readStoredUser());
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  login(request: LoginRequest, rememberMe: boolean): Observable<AuthenticatedUser> {
    return this.http
      .post<AuthenticationResponse>(`${this.authApiUrl}/authenticate`, request)
      .pipe(
        tap((response) => this.persistAuthentication(response, rememberMe)),
        map(() => this.currentUserSubject.value as AuthenticatedUser),
      );
  }

  register(request: RegisterRequest): Observable<string> {
    return this.http.post(`${this.authApiUrl}/register`, request, {
      responseType: 'text',
    });
  }

  logout(): void {
    this.clearStoredAuth();
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();

    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserSubject.value?.roles.includes(role) ?? false;
  }

  getRedirectUrl(): string {
    const currentUser = this.currentUserSubject.value;

    if (!currentUser) {
      throw new Error('Authenticated user context is missing.');
    }

    if (this.hasRole(UserRole.ADMIN)) {
      return '/app/admin/users';
    }

    if (this.hasRole(UserRole.ECONOMIST)) {
      return '/app/economist';
    }

    if (this.hasRole(UserRole.USER)) {
      return '/app/user';
    }

    throw new Error(`Unsupported role '${currentUser.role}'.`);
  }

  private persistAuthentication(response: AuthenticationResponse, rememberMe: boolean): void {
    const user = this.mapAuthenticationResponse(response);
    const storage = this.getWritableStorage(rememberMe);

    this.clearStoredAuth();

    storage?.setItem(this.tokenStorageKey, response.jwToken);
    storage?.setItem(this.userStorageKey, JSON.stringify(user));

    this.currentUserSubject.next(user);
  }

  private mapAuthenticationResponse(response: AuthenticationResponse): AuthenticatedUser {
    const roles = this.normalizeRoles(response.roles);

    return {
      id: response.id,
      email: response.email,
      firstName: response.firstName ?? '',
      lastName: response.lastName ?? '',
      userName: response.userName,
      role: this.getPrimaryRole(roles),
      roles,
      subscriptionTier: SubscriptionTier.DEFAULT,
    };
  }

  private normalizeRoles(rawRoles: string[] | null | undefined): UserRole[] {
    const normalizedRoles = new Set<UserRole>();

    for (const rawRole of rawRoles ?? []) {
      switch ((rawRole ?? '').trim().toUpperCase()) {
        case 'ADMIN':
        case 'SUPERADMIN':
          normalizedRoles.add(UserRole.ADMIN);
          break;
        case 'ECONOMIST':
        case 'MODERATOR':
          normalizedRoles.add(UserRole.ECONOMIST);
          break;
        case 'USER':
        case 'BASIC':
          normalizedRoles.add(UserRole.USER);
          break;
        case '':
          throw new Error('Authentication response contains an empty role value.');
        default:
          throw new Error(`Authentication response contains an unsupported role '${rawRole}'.`);
      }
    }

    if (normalizedRoles.size === 0) {
      throw new Error('Authentication response does not contain any supported roles.');
    }

    return Array.from(normalizedRoles);
  }

  private getPrimaryRole(roles: UserRole[]): UserRole {
    if (roles.includes(UserRole.ADMIN)) {
      return UserRole.ADMIN;
    }

    if (roles.includes(UserRole.ECONOMIST)) {
      return UserRole.ECONOMIST;
    }

    return UserRole.USER;
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
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.tokenStorageKey);
      sessionStorage.removeItem(this.userStorageKey);
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
      const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
      return JSON.parse(decodedPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}