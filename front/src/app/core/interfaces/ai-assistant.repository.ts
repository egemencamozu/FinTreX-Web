import { Observable } from 'rxjs';
import {
  AiConversation,
  AiConversationDetail,
} from '../../presentation/features/ai-assistant/models/ai-conversation.model';
import {
  AiChatRequest,
  AiChatResponse,
} from '../../presentation/features/ai-assistant/models/ai-chat-message.model';

export abstract class AiAssistantRepository {
  // Standart (non-streaming) mesaj gönderimi
  abstract sendMessage(request: AiChatRequest): Observable<AiChatResponse>;

  // SSE streaming — Observable<string> her event data satırını emit eder
  // Component bu string'leri parse eder
  abstract streamMessage(request: AiChatRequest): Observable<string>;

  // Konuşma CRUD
  abstract getConversations(): Observable<AiConversation[]>;
  abstract getConversation(id: number): Observable<AiConversationDetail>;
  abstract deleteConversation(id: number): Observable<void>;
}
