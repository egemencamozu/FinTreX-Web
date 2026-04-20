import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiChatMessage } from '../../models/ai-chat-message.model';

@Component({
  selector: 'app-ai-message-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-message-bubble.component.html',
  styleUrl: './ai-message-bubble.component.scss',
})
export class AiMessageBubbleComponent {
  readonly message = input.required<AiChatMessage>();

  readonly isUser = computed(() => this.message().role === 'User');
  readonly hasTools = computed(() => this.message().toolsUsed.length > 0);
  readonly timestamp = computed(() => {
    return new Date(this.message().sentAtUtc).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  });
}
