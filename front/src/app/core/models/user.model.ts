import { UserRole } from '../enums/user-role.enum';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}
