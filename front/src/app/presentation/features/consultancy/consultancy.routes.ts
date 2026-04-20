import { Routes } from '@angular/router';

export const CONSULTANCY_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'my-economist',
    pathMatch: 'full',
  },
  {
    path: 'my-economist',
    loadComponent: () => import('./pages/my-economist/my-economist').then((m) => m.MyEconomist),
  },
  {
    path: 'my-requests',
    loadComponent: () => import('./pages/my-requests/my-requests').then((m) => m.MyRequests),
  },
];
