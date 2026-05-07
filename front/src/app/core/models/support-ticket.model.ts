import { SupportTicketStatus } from '../enums/support-ticket-status.enum';
import { SupportTicketType } from '../enums/support-ticket-type.enum';

export interface SupportTicket {
  id: number;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  type: SupportTicketType;
  subject: string;
  status: SupportTicketStatus;
  createdAtUtc: string;
  respondedAtUtc?: string | null;
  handledByAdminId?: string | null;
}

export interface CreateSupportTicketRequest {
  type: SupportTicketType;
  subject: string;
  message: string;
}
