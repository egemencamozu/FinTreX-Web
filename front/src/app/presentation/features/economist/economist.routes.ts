import { Routes } from '@angular/router';

export const ECONOMIST_ROUTES: Routes = [
  { path: '', redirectTo: 'customers', pathMatch: 'full' },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'assigned-tasks',
    loadComponent: () => import('./pages/assigned-tasks/assigned-tasks').then((m) => m.AssignedTasks),
  },
  {
    path: 'notes',
    loadComponent: () => import('./pages/notes/notes').then((m) => m.Notes),
  },
];
