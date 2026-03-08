import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRole = route.data?.['requiredRole'] as UserRole | undefined;

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { redirectUrl: state.url },
    });
  }

  if (!requiredRole || authService.hasRole(requiredRole)) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};
