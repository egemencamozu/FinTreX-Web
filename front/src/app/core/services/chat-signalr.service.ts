import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { ChatMessage, Conversation } from '../../presentation/features/chat/models';
import { EnvironmentConfigService } from './environment-config.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ChatSignalRService {
  private hubConnection: signalR.HubConnection | null = null;

  // ── Signals (reactive state) ──
  readonly isConnected = signal(false);
  readonly totalUnreadCount = signal(0);

  // ── Event Subjects ──
  readonly messageReceived$ = new Subject<ChatMessage>();
  readonly messageEdited$ = new Subject<{ messageId: number; newContent: string; editedAtUtc: string }>();
  readonly messageDeleted$ = new Subject<{ messageId: number }>();
  readonly messagesRead$ = new Subject<{ conversationId: number; lastReadMessageId: number; readAtUtc: string }>();
  readonly userTyping$ = new Subject<{ conversationId: number; userId: string; displayName: string }>();
  readonly userOnline$ = new Subject<string>();
  readonly userOffline$ = new Subject<string>();
  readonly conversationCreated$ = new Subject<Conversation>();
  readonly conversationDeleted$ = new Subject<number>();

  constructor(
    private configService: EnvironmentConfigService,
    private authService: AuthService
  ) {}

  async connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return;

    const token = this.authService.getToken();
    if (!token) return;

    // Derive hub URL: apiBaseUrl is like "https://.../api", hub is at "/hubs/chat"
    const apiBase = this.configService.get('apiBaseUrl');
    const hubUrl = apiBase.replace('/api', '') + '/hubs/chat';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.registerEventHandlers();
    this.registerLifecycleHandlers();

    try {
      await this.hubConnection.start();
      this.isConnected.set(true);
    } catch (err) {
      console.error('[ChatSignalR] Connection failed:', err);
      this.isConnected.set(false);
    }
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.isConnected.set(false);
    }
  }

  // ── Hub Method Wrappers ──

  async joinConversation(conversationId: number): Promise<void> {
    if (!this.hubConnection) return;
    
    // If connecting, wait a bit or check state
    if (this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn(`[ChatSignalR] Cannot join group ${conversationId}. Hub state: ${this.hubConnection.state}`);
      return;
    }

    try {
      await this.hubConnection.invoke('JoinConversation', conversationId);
      console.log(`[ChatSignalR] Joined group: chat:${conversationId}`);
    } catch (err) {
      console.error(`[ChatSignalR] JoinConversation failed:`, err);
    }
  }

  async leaveConversation(conversationId: number): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('LeaveConversation', conversationId);
      } catch (err) {
        console.error(`[ChatSignalR] LeaveConversation failed:`, err);
      }
    }
  }

  async sendMessage(conversationId: number, content: string): Promise<ChatMessage | undefined> {
    if (!this.hubConnection) return undefined;
    try {
      return await this.hubConnection.invoke<ChatMessage>('SendMessage', conversationId, content);
    } catch (err) {
      console.error(`[ChatSignalR] SendMessage failed:`, err);
      return undefined;
    }
  }

  async editMessage(messageId: number, newContent: string): Promise<void> {
    await this.hubConnection?.invoke('EditMessage', messageId, newContent);
  }

  async deleteMessage(messageId: number): Promise<void> {
    await this.hubConnection?.invoke('DeleteMessage', messageId);
  }

  async markAsRead(conversationId: number, lastReadMessageId: number): Promise<void> {
    await this.hubConnection?.invoke('MarkAsRead', conversationId, lastReadMessageId);
  }

  async notifyTyping(conversationId: number): Promise<void> {
    await this.hubConnection?.invoke('NotifyTyping', conversationId);
  }

  // ── Private ──

  private registerEventHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveMessage', (msg: ChatMessage) => this.messageReceived$.next(msg));
    this.hubConnection.on('MessageEdited', (id: number, content: string, editedAt: string) =>
      this.messageEdited$.next({ messageId: id, newContent: content, editedAtUtc: editedAt }));
    this.hubConnection.on('MessageDeleted', (id: number) => this.messageDeleted$.next({ messageId: id }));
    this.hubConnection.on('MessagesRead', (convId: number, lastId: number, readAt: string) =>
      this.messagesRead$.next({ conversationId: convId, lastReadMessageId: lastId, readAtUtc: readAt }));
    this.hubConnection.on('UserTyping', (convId: number, userId: string, name: string) =>
      this.userTyping$.next({ conversationId: convId, userId, displayName: name }));
    this.hubConnection.on('UserOnline', (userId: string) => this.userOnline$.next(userId));
    this.hubConnection.on('UserOffline', (userId: string) => this.userOffline$.next(userId));
    this.hubConnection.on('ConversationCreated', (conv: Conversation) => this.conversationCreated$.next(conv));
    this.hubConnection.on('ConversationDeleted', (id: number) => this.conversationDeleted$.next(id));
    this.hubConnection.on('UnreadCountUpdated', (count: number) => this.totalUnreadCount.set(count));
  }

  private registerLifecycleHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => this.isConnected.set(false));
    this.hubConnection.onreconnected(() => this.isConnected.set(true));
    this.hubConnection.onclose(() => this.isConnected.set(false));
  }
}
