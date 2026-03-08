import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/enums/user-role.enum';

export const routes: Routes = [
  // ── Public ────────────────────────────────────────────────────────────────
  {
    path: '',
    loadChildren: () =>
      import('./presentation/features/landing/landing.routes').then(
        (m) => m.LANDING_ROUTES,
      ),
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./presentation/features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // ── Authenticated (MainLayout shell) ──────────────────────────────────────
  {
    path: 'app',
    loadComponent: () =>
      import('./presentation/layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./presentation/features/dashboard/dashboard.routes').then(
            (m) => m.DASHBOARD_ROUTES,
          ),
      },
      {
        path: 'user',
        loadChildren: () =>
          import('./presentation/features/user/user.routes').then((m) => m.USER_ROUTES),
        canActivate: [roleGuard],
        data: { requiredRole: UserRole.USER },
      },
      {
        path: 'economist',
        loadChildren: () =>
          import('./presentation/features/economist/economist.routes').then(
            (m) => m.ECONOMIST_ROUTES,
          ),
        canActivate: [roleGuard],
        data: { requiredRole: UserRole.ECONOMIST },
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./presentation/features/admin/admin.routes').then(
            (m) => m.ADMIN_ROUTES,
          ),
        canActivate: [roleGuard],
        data: { requiredRole: UserRole.ADMIN },
      },
      {
        path: '',
        loadComponent: () =>
          import('./presentation/features/dashboard/pages/role-redirect/role-redirect.page').then(
            (m) => m.RoleRedirectPage,
          ),
      },
    ],
  },

  // ── Wildcard ──────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
