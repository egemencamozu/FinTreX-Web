import { UserRole } from '../../../../core/enums/user-role.enum';

export type UserAccountStatus = 'ACTIVE' | 'INACTIVE';

export type SortKey = 'name' | 'role' | 'status';
export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface UserManagementUser {
  id: string;
  avatarUrl: string | null;
  initials: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  deactivatedUntil: string | null;
}
