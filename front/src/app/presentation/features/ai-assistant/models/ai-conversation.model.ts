import { AiChatMessage } from './ai-chat-message.model';

export interface AiConversation {
  id: number;
  title: string | null;
  createdAtUtc: string;
  lastMessageAtUtc: string | null;
}

export interface AiConversationDetail extends AiConversation {
  messages: AiChatMessage[];
}
