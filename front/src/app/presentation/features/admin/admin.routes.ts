import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  {
    path: 'users',
    loadComponent: () => import('./pages/admin-users/admin-users.page').then((m) => m.AdminUsersPage),
  },
  {
    path: 'economists',
    loadComponent: () => import('./pages/economists/economists').then((m) => m.Economists),
  },
  {
    path: 'subscriptions',
    loadComponent: () => import('./pages/admin-subscriptions/admin-subscriptions.page').then((m) => m.AdminSubscriptionsPage),
  },
  {
    path: 'applications',
    loadComponent: () => import('./pages/applications/applications').then((m) => m.Applications),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'audit',
    loadComponent: () => import('./pages/audit/audit').then((m) => m.Audit),
  },
];
