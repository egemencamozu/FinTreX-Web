import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. JWT is valid → allow immediately
  if (authService.isAuthenticated()) {
    return true;
  }

  // 2. JWT expired but refresh token exists → try silent refresh
  if (authService.hasRefreshToken()) {
    return authService.refreshToken().pipe(
      map(() => true),
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

  // 3. No tokens at all → redirect to login
  return router.createUrlTree(['/auth/login'], {
    queryParams: { redirectUrl: state.url },
  });
};

