import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EconomistStatus } from '../enums/economist-status.enum';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';

const APPLICATION_ROUTES = [
  '/app/economist/application',
  '/app/economist/application-status',
];

export const economistStatusGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasRole(UserRole.ECONOMIST)) {
    return true;
  }

  const status = authService.getEconomistStatus();
  const targetUrl = state.url;

  // Always allow access to application routes regardless of status
  if (APPLICATION_ROUTES.some(r => targetUrl.startsWith(r))) {
    return true;
  }

  switch (status) {
    case EconomistStatus.APPROVED:
      return true;

    case EconomistStatus.PENDING:
      return router.createUrlTree(['/app/economist/application-status']);

    case EconomistStatus.REJECTED:
      return router.createUrlTree(['/app/economist/application-status']);

    case EconomistStatus.NONE:
    default:
      return router.createUrlTree(['/app/economist/application']);
  }
};
