import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatSignalRService } from '../../../../../core/services/chat-signalr.service';
import { ChatRepository } from '../../../../../core/interfaces/chat.repository';
import { AuthService } from '../../../../../core/services/auth.service';
import { Conversation } from '../../models';
import { ConversationListComponent } from '../../components/conversation-list/conversation-list';
import { ChatWindowComponent } from '../../components/chat-window/chat-window';
import { EmptyStateComponent } from '../../components/empty-state/empty-state';
import { NewChatDialogComponent } from '../../components/new-chat-dialog/new-chat-dialog';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ConversationListComponent,
    ChatWindowComponent,
    EmptyStateComponent,
    NewChatDialogComponent,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit, OnDestroy {
  private chatSignalR = inject(ChatSignalRService);
  private chatRepo = inject(ChatRepository);
  private authService = inject(AuthService);
  private subs = new Subscription();

  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  currentUserId = signal<string>('');
  isLoading = signal(true);
  isNewChatDialogOpen = signal(false);

  async ngOnInit() {
    this.currentUserId.set(this.authService.getCurrentUser()?.id ?? '');
    await this.chatSignalR.connect();
    this.registerSignalREvents();
    this.loadConversations();
  }

  ngOnDestroy() {
    this.chatSignalR.disconnect();
    this.subs.unsubscribe();
  }

  private registerSignalREvents() {
    // 1. Yeni Mesaj: Listeyi sırala ve unread count güncelle
    this.subs.add(
      this.chatSignalR.messageReceived$.subscribe((msg) => {
        this.conversations.update((prev) => {
          const list = [...prev];
          const index = list.findIndex((c) => c.id === msg.conversationId);
          if (index !== -1) {
            const conv = { ...list[index] };
            conv.lastMessage = msg;
            conv.lastMessageAtUtc = msg.sentAtUtc;
            
            // Eğer aktif sohbet değilse unread artır
            if (this.activeConversation()?.id !== conv.id) {
              conv.unreadCount++;
            }
            
            list.splice(index, 1);
            list.unshift(conv);
          }
          return list;
        });
      })
    );

    // 2. Online/Offline Durumu
    this.subs.add(
      this.chatSignalR.userOnline$.subscribe((userId) => this.updatePresence(userId, true))
    );
    this.subs.add(
      this.chatSignalR.userOffline$.subscribe((userId) => this.updatePresence(userId, false))
    );

    // 3. Yeni Sohbet (Dışarıdan)
    this.subs.add(
      this.chatSignalR.conversationCreated$.subscribe(() => this.loadConversations())
    );

    // 4. Sohbet Silindi (Dışarıdan)
    this.subs.add(
      this.chatSignalR.conversationDeleted$.subscribe((id) => {
        this.conversations.update((prev) => prev.filter((c) => c.id !== id));
        if (this.activeConversation()?.id === id) {
          this.activeConversation.set(null);
        }
      })
    );
  }

  private updatePresence(userId: string, isOnline: boolean) {
    this.conversations.update((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants.map((p) =>
          p.userId === userId ? { ...p, isOnline } : p
        ),
      }))
    );
  }

  loadConversations() {
    this.isLoading.set(true);
    this.chatRepo.getMyConversations().subscribe({
      next: (convs) => {
        this.conversations.set(convs);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onConversationSelected(conv: Conversation) {
    // Leave previous group
    const prev = this.activeConversation();
    if (prev) this.chatSignalR.leaveConversation(prev.id);

    this.activeConversation.set(conv);
    this.chatSignalR.joinConversation(conv.id);
  }

  openNewChatDialog() {
    this.isNewChatDialogOpen.set(true);
  }

  onConversationCreated(conv: Conversation) {
    this.loadConversations();
    this.onConversationSelected(conv);
  }

  onRenameConversation(event: { id: number; title: string }) {
    this.chatRepo.updateTitle(event.id, { title: event.title }).subscribe({
      next: () => {
        this.loadConversations();
        // Update active if it's the renamed one
        if (this.activeConversation()?.id === event.id) {
          this.activeConversation.update((prev) => (prev ? { ...prev, title: event.title } : null));
        }
      },
    });
  }

  onDeleteConversation(id: number) {
    this.chatRepo.deleteConversation(id).subscribe({
      next: () => {
        this.loadConversations();
        if (this.activeConversation()?.id === id) {
          this.activeConversation.set(null);
        }
      },
    });
  }
}
