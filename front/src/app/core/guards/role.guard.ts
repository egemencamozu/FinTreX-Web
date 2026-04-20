import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRole = route.data?.['requiredRole'] as UserRole | undefined;

  // 1. JWT is valid → check role
  if (authService.isAuthenticated()) {
    if (!requiredRole || authService.hasRole(requiredRole)) {
      return true;
    }
    return router.createUrlTree(['/app/forbidden']);
  }

  // 2. JWT expired but refresh token exists → try silent refresh, then check role
  if (authService.hasRefreshToken()) {
    return authService.refreshToken().pipe(
      map(() => {
        if (!requiredRole || authService.hasRole(requiredRole)) {
          return true;
        }
        return router.createUrlTree(['/app/forbidden']);
      }),
      catchError(() => {
        authService.logout();
        return of(
          router.createUrlTree(['/auth/login'], {
            queryParams: { redirectUrl: state.url },
          }),
        );
      }),
    );
  }

  // 3. No tokens → redirect to login
  return router.createUrlTree(['/auth/login'], {
    queryParams: { redirectUrl: state.url },
  });
};

