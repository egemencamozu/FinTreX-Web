import { ChatMessage } from './chat-message.model';

export interface Conversation {
  id: number;
  title: string | null;
  createdByUserId: string;
  createdAtUtc: string;
  lastMessageAtUtc: string | null;
  participants: ConversationParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface ConversationParticipant {
  userId: string;
  displayName: string;
  role: 'User' | 'Economist';
  isOnline: boolean;
}
