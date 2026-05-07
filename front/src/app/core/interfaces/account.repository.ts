import { Observable } from 'rxjs';
import { ChangePasswordRequest, Session } from '../models/session.model';

export abstract class AccountRepository {
  abstract changePassword(request: ChangePasswordRequest): Observable<{ message: string }>;
  abstract getSessions(): Observable<Session[]>;
  abstract revokeSession(sessionId: number): Observable<{ message: string }>;
  abstract revokeOtherSessions(): Observable<{ message: string }>;
}
