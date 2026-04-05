import { Routes } from '@angular/router';

export const SUBSCRIPTION_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'manage',
    pathMatch: 'full',
  },
  {
    path: 'manage',
    loadComponent: () => import('./pages/manage/manage').then((m) => m.Manage),
  },
  {
    path: 'billing',
    loadComponent: () => import('./pages/billing/billing').then((m) => m.Billing),
  },
];
