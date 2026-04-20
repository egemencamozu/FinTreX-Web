import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation } from '../../models';
import { inject } from '@angular/core';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-conversation-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conversation-item.html',
  styleUrl: './conversation-item.scss',
})
export class ConversationItemComponent {
  @Input() conversation!: Conversation;
  @Input() isActive: boolean = false;
  @Output() renameRequested = new EventEmitter<{id: number, title: string}>();
  @Output() deleteRequested = new EventEmitter<number>();

  isEditing = signal(false);
  editTitle = signal('');

  private authService = inject(AuthService);

  get peerParticipant() {
    const user = this.authService.getCurrentUser();
    if (!user || !this.conversation.participants) return null;

    const currentId = user.id.toLowerCase();
    return this.conversation.participants.find(p => p.userId.toLowerCase() !== currentId) 
        || this.conversation.participants[0];
  }

  get peerName(): string {
    return this.peerParticipant?.displayName || 'Kullanıcı';
  }

  get displayName(): string {
    return this.conversation.title || this.peerName;
  }

  get isOnline(): boolean {
    return this.peerParticipant?.isOnline ?? false;
  }

  get lastMessageText(): string {
    if (!this.conversation.lastMessage) return 'Henüz mesaj yok';
    if (this.conversation.lastMessage.isDeleted) return 'Mesaj silindi';
    return this.conversation.lastMessage.content;
  }

  startEditing(event: MouseEvent) {
    event.stopPropagation();
    this.editTitle.set(this.conversation.title || this.peerName);
    this.isEditing.set(true);
  }

  saveRename() {
    const newTitle = this.editTitle().trim();
    if (newTitle && newTitle !== (this.conversation.title || this.peerName)) {
      this.renameRequested.emit({ id: this.conversation.id, title: newTitle });
    }
    this.isEditing.set(false);
  }

  cancelRename() {
    this.isEditing.set(false);
  }

  requestDelete(event: MouseEvent) {
    event.stopPropagation();
    if (confirm('Bu sohbeti silmek istediğinizden emin misiniz?')) {
      this.deleteRequested.emit(this.conversation.id);
    }
  }
}
