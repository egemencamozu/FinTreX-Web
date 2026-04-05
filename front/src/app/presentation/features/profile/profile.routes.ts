import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'info',
    pathMatch: 'full',
  },
  {
    path: 'info',
    loadComponent: () => import('./pages/info/info').then((m) => m.Info),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'account-actions',
    loadComponent: () =>
      import('./pages/account-actions/account-actions').then((m) => m.AccountActions),
  },
];
