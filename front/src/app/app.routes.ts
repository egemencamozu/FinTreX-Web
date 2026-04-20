import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/enums/user-role.enum';

export const routes: Routes = [
  // ── Public ────────────────────────────────────────────────────────────────
  {
    path: '',
    loadChildren: () =>
      import('./presentation/features/landing/landing.routes').then((m) => m.LANDING_ROUTES),
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
        path: 'portfolio',
        loadChildren: () =>
          import('./presentation/features/portfolio/portfolio.routes').then(
            (m) => m.PORTFOLIO_ROUTES,
          ),
      },
      {
        path: 'consultancy',
        loadChildren: () =>
          import('./presentation/features/consultancy/consultancy.routes').then(
            (m) => m.CONSULTANCY_ROUTES,
          ),
      },
      {
        path: 'chat',
        loadChildren: () =>
          import('./presentation/features/chat/chat.routes').then((m) => m.CHAT_ROUTES),
      },
      {
        path: 'ai-assistant',
        loadChildren: () =>
          import('./presentation/features/ai-assistant/ai-assistant.routes').then(
            (m) => m.AI_ASSISTANT_ROUTES
          ),
      },
      {
        path: 'subscription',
        loadChildren: () =>
          import('./presentation/features/subscription/subscription.routes').then(
            (m) => m.SUBSCRIPTION_ROUTES,
          ),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./presentation/features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
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
          import('./presentation/features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
        canActivate: [roleGuard],
        data: { requiredRole: UserRole.ADMIN },
      },
      {
        path: 'test',
        loadChildren: () =>
          import('./presentation/features/test-page/test-page.routes').then(
            (m) => m.TEST_PAGE_ROUTES,
          ),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./presentation/shared/pages/forbidden/forbidden.page').then(
            (m) => m.ForbiddenPage,
          ),
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
