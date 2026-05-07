import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  SupportTicketRepository,
  UpdateSupportTicketRequest,
} from '../../core/interfaces/support-ticket.repository';
import { CreateSupportTicketRequest, SupportTicket } from '../../core/models/support-ticket.model';
import { SupportTicketMessage } from '../../core/models/support-ticket-message.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({ providedIn: 'root' })
export class SupportTicketApiRepository extends SupportTicketRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(EnvironmentConfigService);
  private readonly baseUrl = `${this.config.get('apiBaseUrl')}/v1/SupportTickets`;

  override getMyTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(`${this.baseUrl}/me`);
  }

  override getTicketById(id: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.baseUrl}/${id}`);
  }

  override createTicket(request: CreateSupportTicketRequest): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(this.baseUrl, request);
  }

  override getAll(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(this.baseUrl);
  }

  override updateTicket(
    id: number,
    request: UpdateSupportTicketRequest,
  ): Observable<SupportTicket> {
    return this.http.patch<SupportTicket>(`${this.baseUrl}/${id}`, request);
  }

  override getOpenCount(): Observable<number> {
    return this.http
      .get<{ count: number }>(`${this.baseUrl}/open-count`)
      .pipe(map((r) => r.count));
  }

  override deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  override getMessages(ticketId: number): Observable<SupportTicketMessage[]> {
    return this.http.get<SupportTicketMessage[]>(`${this.baseUrl}/${ticketId}/messages`);
  }

  override sendMessage(ticketId: number, body: string): Observable<SupportTicketMessage> {
    return this.http.post<SupportTicketMessage>(`${this.baseUrl}/${ticketId}/messages`, { body });
  }
}
