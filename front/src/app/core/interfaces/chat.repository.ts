import { Observable } from 'rxjs';
import {
  Conversation,
  ChatMessage,
  CreateConversationRequest,
  UpdateConversationTitleRequest,
  CursorPagedResult,
} from '../../presentation/features/chat/models';

export abstract class ChatRepository {
  abstract getMyConversations(): Observable<Conversation[]>;
  abstract getConversation(id: number): Observable<Conversation>;
  abstract createConversation(request: CreateConversationRequest): Observable<Conversation>;
  abstract deleteConversation(id: number): Observable<void>;
  abstract updateTitle(id: number, request: UpdateConversationTitleRequest): Observable<void>;
  abstract getMessages(
    conversationId: number,
    before?: number,
    pageSize?: number
  ): Observable<CursorPagedResult<ChatMessage>>;
  abstract getUnreadCount(): Observable<{ totalUnreadCount: number }>;
}
