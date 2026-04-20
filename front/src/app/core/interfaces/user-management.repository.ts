import { Observable, map } from 'rxjs';
import { UserRole } from '../enums/user-role.enum';
import { UserSummary } from '../models/user-summary.model';

export type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export interface UserListFilters {
  role?: UserRole | 'ALL';
  status?: UserStatusFilter;
  search?: string;
}

export abstract class UserManagementRepository {
  abstract getMyProfile(): Observable<UserSummary>;
  abstract getAllUsers(): Observable<UserSummary[]>;
  abstract getUserById(userId: string): Observable<UserSummary>;
  abstract deactivateUser(userId: string, durationKey: string): Observable<{ message: string }>;
  abstract activateUser(userId: string): Observable<{ message: string }>;
  abstract bulkDeactivate(userIds: string[], durationKey: string): Observable<{ message: string }>;
  abstract bulkActivate(userIds: string[]): Observable<{ message: string }>;

  getUsers(filters: UserListFilters = {}): Observable<UserSummary[]> {

    return this.getAllUsers().pipe(
      map((users) => this.applyFilters(users, filters)),
    );
  }

  updateUserStatus(
    userId: string,
    isActive: boolean,
    durationKey = 'ONE_WEEK',
  ): Observable<{ message: string }> {
    if (isActive) {
      return this.activateUser(userId);
    }

    return this.deactivateUser(userId, durationKey);
  }

  private applyFilters(users: UserSummary[], filters: UserListFilters): UserSummary[] {
    const normalizedSearch = (filters.search ?? '').trim().toLowerCase();

    return users.filter((user) => {
      if (filters.role && filters.role !== 'ALL' && user.role?.toUpperCase() !== filters.role) {
        return false;
      }

      if (filters.status === 'ACTIVE' && !user.isActive) {
        return false;
      }

      if (filters.status === 'INACTIVE' && user.isActive) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
      const email = (user.email ?? '').toLowerCase();
      const userName = (user.userName ?? '').toLowerCase();

      return (
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        userName.includes(normalizedSearch)
      );
    });
  }
}
