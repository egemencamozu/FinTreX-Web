import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRepository } from '../../core/interfaces/chat.repository';
import {
  Conversation,
  ChatMessage,
  CreateConversationRequest,
  UpdateConversationTitleRequest,
  CursorPagedResult,
} from '../../presentation/features/chat/models';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({ providedIn: 'root' })
export class ChatApiRepository extends ChatRepository {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    super();
    this.baseUrl = `${this.configService.get('apiBaseUrl')}/v1/Chats`;
  }

  getMyConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(this.baseUrl);
  }

  getConversation(id: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.baseUrl}/${id}`);
  }

  createConversation(request: CreateConversationRequest): Observable<Conversation> {
    return this.http.post<Conversation>(this.baseUrl, request);
  }

  deleteConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  updateTitle(id: number, request: UpdateConversationTitleRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/title`, request);
  }

  getMessages(
    conversationId: number,
    before?: number,
    pageSize: number = 30
  ): Observable<CursorPagedResult<ChatMessage>> {
    let params = new HttpParams().set('pageSize', pageSize.toString());
    if (before) {
      params = params.set('before', before.toString());
    }
    return this.http.get<CursorPagedResult<ChatMessage>>(
      `${this.baseUrl}/${conversationId}/messages`,
      { params }
    );
  }

  getUnreadCount(): Observable<{ totalUnreadCount: number }> {
    return this.http.get<{ totalUnreadCount: number }>(`${this.baseUrl}/unread-count`);
  }
}
