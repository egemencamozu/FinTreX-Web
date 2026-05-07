import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users.page').then((m) => m.UserManagementPageComponent),
  },
  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./pages/admin-subscriptions/admin-subscriptions.page').then(
        (m) => m.AdminSubscriptionsPage
      ),
  },
  {
    path: 'support-tickets',
    loadComponent: () =>
      import('./pages/support-tickets/support-tickets').then((m) => m.SupportTickets),
  },
  {
    path: 'revenue',
    loadComponent: () =>
      import('./pages/admin-revenue/admin-revenue.page').then((m) => m.AdminRevenuePage),
  },
  {
    path: 'economists',
    loadComponent: () =>
      import('./pages/economists/economists').then((m) => m.Economists),
  },
  {
    path: 'economist-applications',
    loadComponent: () =>
      import('./pages/economist-applications/economist-applications.page').then(
        (m) => m.EconomistApplicationsPage
      ),
  },
  {
    path: 'economist-applications/:id',
    loadComponent: () =>
      import('./pages/economist-application-detail/economist-application-detail.page').then(
        (m) => m.EconomistApplicationDetailPage
      ),
  },
];
