import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  signal,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Conversation, ChatMessage } from '../../models';
import { ChatRepository } from '../../../../../core/interfaces/chat.repository';
import { ChatSignalRService } from '../../../../../core/services/chat-signalr.service';
import { ChatHeaderComponent } from '../chat-header/chat-header';
import { MessageBubbleComponent } from '../message-bubble/message-bubble';
import { ChatInputComponent } from '../chat-input/chat-input';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatHeaderComponent, MessageBubbleComponent, ChatInputComponent],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss',
})
export class ChatWindowComponent implements OnInit, OnDestroy, OnChanges {
  @Input() conversation!: Conversation;
  @Input() currentUserId: string = '';

  @ViewChild('scrollFrame') scrollFrame!: ElementRef;

  private chatRepo = inject(ChatRepository);
  private chatSignalR = inject(ChatSignalRService);
  private subs = new Subscription();

  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  hasMore = signal(false);
  nextCursor = signal<number | null>(null);
  isTyping = signal(false);
  typingUser = signal('');
  private typingTimeout: any;

  private currentConversationId: number | null = null;

  constructor() {
    // Reactively join group when connection is ready or conversation changes
    effect(() => {
      const isConnected = this.chatSignalR.isConnected();
      const convId = this.conversation?.id;
      
      if (isConnected && convId) {
        this.chatSignalR.joinConversation(convId);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['conversation']) {
      const newConv = changes['conversation'].currentValue as Conversation;
      const oldConv = changes['conversation'].previousValue as Conversation;

      if (oldConv && oldConv.id) {
        this.chatSignalR.leaveConversation(oldConv.id);
      }

      if (newConv && newConv.id) {
        this.currentConversationId = newConv.id;
        this.chatSignalR.joinConversation(newConv.id);
        this.resetAndLoadMessages();
      }
    }
  }

  ngOnInit() {
    this.registerSignalREvents();
    if (this.conversation?.id && !this.currentConversationId) {
      this.currentConversationId = this.conversation.id;
      this.chatSignalR.joinConversation(this.conversation.id);
    }
  }

  ngOnDestroy() {
    if (this.currentConversationId) {
      this.chatSignalR.leaveConversation(this.currentConversationId);
    }
    this.subs.unsubscribe();
    clearTimeout(this.typingTimeout);
  }

  private registerSignalREvents() {
    // 1. Receive Message
    this.subs.add(
      this.chatSignalR.messageReceived$.subscribe((msg) => {
        if (msg.conversationId === this.conversation.id) {
          this.messages.update((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          this.scrollToBottom();
          this.markAsRead(msg.id);
        }
      })
    );

    // 2. Message Edited
    this.subs.add(
      this.chatSignalR.messageEdited$.subscribe((update) => {
        this.messages.update((prev) =>
          prev.map((m) =>
            m.id === update.messageId
              ? { ...m, content: update.newContent, editedAtUtc: update.editedAtUtc }
              : m
          )
        );
      })
    );

    // 3. Message Deleted
    this.subs.add(
      this.chatSignalR.messageDeleted$.subscribe((update) => {
        this.messages.update((prev) =>
          prev.map((m) =>
            m.id === update.messageId ? { ...m, isDeleted: true, content: '' } : m
          )
        );
      })
    );

    // 4. User Typing
    this.subs.add(
      this.chatSignalR.userTyping$.subscribe((data) => {
        if (data.conversationId === this.conversation.id) {
          this.showTyping(data.displayName);
        }
      })
    );
  }

  private resetAndLoadMessages() {
    this.messages.set([]);
    this.nextCursor.set(null);
    this.hasMore.set(false);
    this.loadMessages();
  }

  loadMessages(before?: number) {
    this.isLoading.set(true);
    this.chatRepo.getMessages(this.conversation.id, before).subscribe({
      next: (result) => {
        if (before) {
          // Pagination: prepend
          this.messages.update((prev) => [...result.items.reverse(), ...prev]);
        } else {
          // Initial load: set and scroll
          this.messages.set(result.items.reverse());
          this.scrollToBottom();
          
          // Mark last message as read
          if (this.messages().length > 0) {
            this.markAsRead(this.messages()[this.messages().length - 1].id);
          }
        }
        this.nextCursor.set(result.nextCursor);
        this.hasMore.set(result.hasMore);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  async onSendMessage(content: string) {
    const msg = await this.chatSignalR.sendMessage(this.conversation.id, content);
    if (msg) {
      this.messages.update((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      this.scrollToBottom();
    }
  }

  onTyping() {
    this.chatSignalR.notifyTyping(this.conversation.id);
  }

  onEditMessage(event: { id: number; content: string }) {
    this.chatSignalR.editMessage(event.id, event.content);
  }

  onDeleteMessage(messageId: number) {
    this.chatSignalR.deleteMessage(messageId);
  }

  private markAsRead(messageId: number) {
    this.chatSignalR.markAsRead(this.conversation.id, messageId);
  }

  private showTyping(name: string) {
    this.typingUser.set(name);
    this.isTyping.set(true);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.isTyping.set(false), 3000);
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollFrame) {
        this.scrollFrame.nativeElement.scrollTop = this.scrollFrame.nativeElement.scrollHeight;
      }
    }, 100);
  }

  showScrollFab = signal(false);

  onScroll(event: any) {
    const target = event.target as HTMLElement;
    
    // Basic infinite scroll (top)
    if (target.scrollTop === 0 && this.hasMore() && !this.isLoading()) {
      this.loadMessages(this.nextCursor() ?? undefined);
    }
    
    // Check if near bottom to show/hide FAB
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    this.showScrollFab.set(!isNearBottom);
  }

  forceScrollToBottom() {
    this.scrollToBottom();
  }

  showDateDivider(index: number, msg: ChatMessage): boolean {
    if (index === 0) return true;
    const prev = this.messages()[index - 1];
    return new Date(msg.sentAtUtc).toDateString() !== new Date(prev.sentAtUtc).toDateString();
  }

  formatDateDivider(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Bugün';
    if (date.toDateString() === yesterday.toDateString()) return 'Dün';
    
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
