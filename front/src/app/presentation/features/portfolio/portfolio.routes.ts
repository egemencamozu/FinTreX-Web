import { Routes } from '@angular/router';

export const PORTFOLIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/portfolio/portfolio').then((m) => m.Portfolio),
  },
  {
    path: 'watchlist',
    loadComponent: () => import('./pages/watchlist/watchlist').then((m) => m.Watchlist),
  },
  {
    path: 'markets',
    loadComponent: () => import('./pages/markets/markets').then((m) => m.Markets),
  },
];
