import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';
import { UserRole } from '../../../core/enums/user-role.enum';

export const PORTFOLIO_ROUTES: Routes = [
  {
    path: 'client/:clientId',
    canActivate: [roleGuard],
    data: { requiredRole: UserRole.ECONOMIST },
    loadComponent: () => import('./pages/portfolio/portfolio').then((m) => m.Portfolio),
  },
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
