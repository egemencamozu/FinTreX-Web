export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: string;
  senderName: string;
  messageType: string;
  content: string;
  sentAtUtc: string;
  editedAtUtc: string | null;
  isDeleted: boolean;
}
