import { Component, output } from '@angular/core';

@Component({
  selector: 'app-ai-empty-state',
  standalone: true,
  templateUrl: './ai-empty-state.component.html',
  styleUrl: './ai-empty-state.component.scss',
})
export class AiEmptyStateComponent {
  readonly startNewChat = output<void>();
}
