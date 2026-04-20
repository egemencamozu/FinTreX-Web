import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiConversation } from '../../models/ai-conversation.model';

@Component({
  selector: 'app-ai-conversation-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-conversation-list.component.html',
  styleUrl: './ai-conversation-list.component.scss',
})
export class AiConversationListComponent {
  readonly conversations = input.required<AiConversation[]>();
  readonly selectedId = input<number | null>(null);
  readonly isLoading = input<boolean>(false);

  readonly conversationSelected = output<number>();
  readonly conversationDeleted = output<number>();
  readonly newChatStarted = output<void>();

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();

    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    // Otherwise show date
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  }

  protected onDelete(event: Event, id: number): void {
    event.stopPropagation();
    if (confirm('Bu konuşmayı silmek istediğinize emin misiniz?')) {
      this.conversationDeleted.emit(id);
    }
  }
}
