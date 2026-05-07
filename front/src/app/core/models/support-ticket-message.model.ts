export interface SupportTicketMessage {
  id: number;
  supportTicketId: number;
  senderId: string;
  senderRole: 'User' | 'Admin';
  senderName: string;
  body: string;
  sentAtUtc: string;
}
