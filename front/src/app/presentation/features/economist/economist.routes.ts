import { Routes } from '@angular/router';

export const ECONOMIST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/economist-home/economist-home.page').then(
        (m) => m.EconomistHomePage,
      ),
  },
];