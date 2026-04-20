import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation } from '../../models';
import { ConversationItemComponent } from '../conversation-item/conversation-item';
import { inject } from '@angular/core';
import { AuthService } from '../../../../../core/services/auth.service';
import { UserRole } from '../../../../../core/enums/user-role.enum';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ConversationItemComponent],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss',
})
export class ConversationListComponent {
  @Input() conversations: Conversation[] = [];
  @Input() activeConversationId: number | null = null;
  @Input() isLoading = false;
  @Output() conversationSelected = new EventEmitter<Conversation>();
  @Output() conversationsChanged = new EventEmitter<void>();
  @Output() newChatRequested = new EventEmitter<void>();
  @Output() renameRequested = new EventEmitter<{id: number, title: string}>();
  @Output() deleteRequested = new EventEmitter<number>();

  searchTerm = signal('');
  private authService = inject(AuthService);

  get filteredConversations(): Conversation[] {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.conversations;

    const currentUserId = this.authService.getCurrentUser()?.id;

    return this.conversations.filter((c) => {
      const title = (c.title || '').toLowerCase();
      const peer = c.participants
        .find((p) => p.userId !== currentUserId)
        ?.displayName?.toLowerCase() || '';
      
      return title.includes(term) || peer.includes(term);
    });
  }

  get canStartNewChat(): boolean {
    return this.authService.hasRole(UserRole.USER) || this.authService.hasRole(UserRole.ADMIN);
  }

  onNewChat() {
    this.newChatRequested.emit();
  }
}
