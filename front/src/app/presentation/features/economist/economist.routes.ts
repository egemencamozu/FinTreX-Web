import { Routes } from '@angular/router';

export const ECONOMIST_ROUTES: Routes = [
  { path: '', redirectTo: 'customers', pathMatch: 'full' },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'tasks',
    loadComponent: () => import('./pages/tasks/tasks').then((m) => m.Tasks),
  },
  {
    path: 'notes',
    loadComponent: () => import('./pages/notes/notes').then((m) => m.Notes),
  },
];
