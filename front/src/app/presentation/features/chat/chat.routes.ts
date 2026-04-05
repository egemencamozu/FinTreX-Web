import { Routes } from '@angular/router';

export const CHAT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/chat/chat').then((m) => m.Chat),
  },
];
