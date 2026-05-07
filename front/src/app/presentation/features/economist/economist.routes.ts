import { Routes } from '@angular/router';
import { economistStatusGuard } from '../../../core/guards/economist-status.guard';

export const ECONOMIST_ROUTES: Routes = [
  { path: '', redirectTo: 'customers', pathMatch: 'full' },
  {
    path: 'application',
    loadComponent: () =>
      import('./pages/application-form/application-form.component').then(
        (m) => m.ApplicationFormComponent
      ),
  },
  {
    path: 'application-status',
    loadComponent: () =>
      import('./pages/application-status/application-status.component').then(
        (m) => m.ApplicationStatusComponent
      ),
  },
  {
    path: 'customers',
    canActivate: [economistStatusGuard],
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'assigned-tasks',
    canActivate: [economistStatusGuard],
    loadComponent: () => import('./pages/assigned-tasks/assigned-tasks').then((m) => m.AssignedTasks),
  },
];
