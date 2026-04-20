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
];
