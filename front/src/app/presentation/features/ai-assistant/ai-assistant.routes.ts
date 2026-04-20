import { Routes } from '@angular/router';
import { AiChatComponent } from './pages/ai-chat/ai-chat.component';

export const AI_ASSISTANT_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full',
  },
  {
    path: 'chat',
    component: AiChatComponent,
    title: 'AI Portföy Asistanı | FinTreX',
  },
];
