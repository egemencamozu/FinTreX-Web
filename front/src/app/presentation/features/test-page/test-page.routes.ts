import { Routes } from '@angular/router';

export const TEST_PAGE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/test-page/test-page').then((m) => m.TestPage),
  },
];
