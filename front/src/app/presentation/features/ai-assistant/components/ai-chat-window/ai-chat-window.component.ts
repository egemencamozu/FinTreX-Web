import {
  Component,
  input,
  output,
  viewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiChatMessage } from '../../models/ai-chat-message.model';
import { AiMessageBubbleComponent } from '../ai-message-bubble/ai-message-bubble.component';
import { AiTypingIndicatorComponent } from '../ai-typing-indicator/ai-typing-indicator.component';
import { AiChatInputComponent } from '../ai-chat-input/ai-chat-input.component';
import { AiEmptyStateComponent } from '../ai-empty-state/ai-empty-state.component';

@Component({
  selector: 'app-ai-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    AiMessageBubbleComponent,
    AiTypingIndicatorComponent,
    AiChatInputComponent,
    AiEmptyStateComponent,
  ],
  templateUrl: './ai-chat-window.component.html',
  styleUrl: './ai-chat-window.component.scss',
})
export class AiChatWindowComponent {
  readonly messages = input.required<AiChatMessage[]>();
  readonly activeConversationId = input<number | null>(null);
  readonly isAITyping = input<boolean>(false);
  readonly showEmptyState = input<boolean>(false);

  readonly messageSent = output<string>();
  readonly startChatRequested = output<void>();

  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>(
    'scrollContainer'
  );

  constructor() {
    // Auto-scroll effect when messages change or typing status changes
    effect(() => {
      this.messages();
      this.isAITyping();
      this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  }
}
