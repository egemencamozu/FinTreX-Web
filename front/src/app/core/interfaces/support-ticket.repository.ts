import { Observable } from 'rxjs';
import { SupportTicketStatus } from '../enums/support-ticket-status.enum';
import { CreateSupportTicketRequest, SupportTicket } from '../models/support-ticket.model';
import { SupportTicketMessage } from '../models/support-ticket-message.model';

export interface UpdateSupportTicketRequest {
  status: SupportTicketStatus;
}

export abstract class SupportTicketRepository {
  abstract getMyTickets(): Observable<SupportTicket[]>;
  abstract getTicketById(id: number): Observable<SupportTicket>;
  abstract createTicket(request: CreateSupportTicketRequest): Observable<SupportTicket>;

  // ── Admin ────────────────────────────────────────────────────────────────
  abstract getAll(): Observable<SupportTicket[]>;
  abstract updateTicket(id: number, request: UpdateSupportTicketRequest): Observable<SupportTicket>;
  abstract getOpenCount(): Observable<number>;
  abstract deleteTicket(id: number): Observable<void>;

  // ── Chat ─────────────────────────────────────────────────────────────────
  abstract getMessages(ticketId: number): Observable<SupportTicketMessage[]>;
  abstract sendMessage(ticketId: number, body: string): Observable<SupportTicketMessage>;
}
