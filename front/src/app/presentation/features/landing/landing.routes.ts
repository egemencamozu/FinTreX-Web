import { Routes } from '@angular/router';

export const LANDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing-home/landing-home.page').then((m) => m.LandingHomePage),
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing/pricing').then((m) => m.Pricing),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
  },
  {
    path: 'trial',
    loadComponent: () => import('./pages/trial/trial').then((m) => m.Trial),
  },
];
