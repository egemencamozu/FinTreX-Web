export interface UserSummary {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  phoneNumber?: string;
  emailConfirmed: boolean;
  role: string;
  isActive: boolean;
  lastLogin?: string | null;
  deactivatedUntil?: string | null;
}
