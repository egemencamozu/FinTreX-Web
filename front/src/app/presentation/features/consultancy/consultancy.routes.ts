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
    path: 'tasks',
    loadComponent: () => import('./pages/tasks/tasks').then((m) => m.Tasks),
  },
];
