import { Observable } from 'rxjs';
import { UserSummary } from '../models/user-summary.model';

export abstract class UserManagementRepository {
  abstract getMyProfile(): Observable<UserSummary>;
  abstract getAllUsers(): Observable<UserSummary[]>;
  abstract getUserById(userId: string): Observable<UserSummary>;
  abstract deactivateUser(userId: string, durationKey: string): Observable<{ message: string }>;
  abstract activateUser(userId: string): Observable<{ message: string }>;
}
