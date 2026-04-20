export type AiMessageRole = 'User' | 'Assistant';

export interface AiChatMessage {
  id: number;
  role: AiMessageRole;
  content: string;
  toolsUsed: string[];
  partialData: boolean;
  sentAtUtc: string;
}

export interface AiChatRequest {
  conversationId: number | null;
  message: string;
  clientId?: string | null;
}

export interface AiChatResponse {
  conversationId: number;
  messageId: number;
  message: string;
  toolsUsed: string[];
  partialData: boolean;
  isSuccessful: boolean;
}

// SSE olayları — streaming için
export type SseEventType = 'token' | 'tool_start' | 'done' | 'error';

export interface SseTokenEvent {
  type: 'token';
  content: string;
}

export interface SseToolStartEvent {
  type: 'tool_start';
  tool: string;
}

export interface SseDoneEvent {
  type: 'done';
  partial_data: boolean;
  conversation_id: number;
  message_id: number;
}

export interface SseErrorEvent {
  type: 'error';
  message: string;
}
