import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Conversation } from '../../models';
import { inject } from '@angular/core';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.scss',
})
export class ChatHeaderComponent {
  @Input() conversation!: Conversation;
  @Output() infoClicked = new EventEmitter<void>();

  private authService = inject(AuthService);

  get peerParticipant() {
    const user = this.authService.getCurrentUser();
    if (!user || !this.conversation.participants) return null;
    
    const currentId = user.id.toLowerCase();
    return this.conversation.participants.find(p => p.userId.toLowerCase() !== currentId) 
        || this.conversation.participants[0];
  }

  get peerName() {
    return this.peerParticipant?.displayName || 'Kullanıcı';
  }

  get displayName() {
    return this.conversation.title || this.peerName;
  }

  get isOnline(): boolean {
    return this.peerParticipant?.isOnline ?? false;
  }
}
