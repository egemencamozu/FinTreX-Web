import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users.page').then(
        (m) => m.AdminUsersPage,
      ),
  },
  {
    path: 'applications',
    loadComponent: () =>
      import('./pages/admin-applications/admin-applications.page').then(
        (m) => m.AdminApplicationsPage,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/admin-settings/admin-settings.page').then(
        (m) => m.AdminSettingsPage,
      ),
  },
];
