import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { AiAssistantRepository } from '../../core/interfaces/ai-assistant.repository';
import {
  AiConversation,
  AiConversationDetail,
} from '../../presentation/features/ai-assistant/models/ai-conversation.model';
import {
  AiChatRequest,
  AiChatResponse,
} from '../../presentation/features/ai-assistant/models/ai-chat-message.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';
import { AuthService } from '../../core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class AiAssistantApiRepository extends AiAssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(EnvironmentConfigService);
  private readonly auth = inject(AuthService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/v1/AiAssistant`;
  }

  sendMessage(request: AiChatRequest): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(`${this.baseUrl}/chat`, request);
  }

  /**
   * SSE streaming via fetch API (POST tabanlı — EventSource desteklemiyor).
   * Observable her emit'te ham bir SSE satırı ("data: {...}") üretir.
   * complete() stream sona erdiğinde çağrılır.
   * error() fetch hatası veya HTTP >=400 durumunda çağrılır.
   */
  streamMessage(request: AiChatRequest): Observable<string> {
    const subject = new Subject<string>();

    const token = this.auth.getToken();
    const url = `${this.baseUrl}/chat/stream`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
    })
      .then(async (response) => {
        if (!response.ok) {
          subject.error(new Error(`HTTP ${response.status}`));
          return;
        }
        if (!response.body) {
          subject.error(new Error('Response body is null'));
          return;
        }

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Her chunk birden fazla satır içerebilir
            const lines = value.split('\n');
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                subject.next(line.trim());
              }
            }
          }
          subject.complete();
        } catch (err) {
          subject.error(err);
        } finally {
          reader.releaseLock();
        }
      })
      .catch((err) => subject.error(err));

    return subject.asObservable();
  }

  getConversations(): Observable<AiConversation[]> {
    return this.http.get<AiConversation[]>(`${this.baseUrl}/conversations`);
  }

  getConversation(id: number): Observable<AiConversationDetail> {
    return this.http.get<AiConversationDetail>(
      `${this.baseUrl}/conversations/${id}`
    );
  }

  deleteConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/conversations/${id}`);
  }
}
