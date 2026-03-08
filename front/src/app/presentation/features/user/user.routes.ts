import { Routes } from '@angular/router';

export const USER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/user-home/user-home.page').then((m) => m.UserHomePage),
  },
];