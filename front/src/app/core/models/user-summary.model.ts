export interface UserSummary {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  emailConfirmed: boolean;
  role: string;
  isActive: boolean;
  deactivatedUntil?: string | null;
}
