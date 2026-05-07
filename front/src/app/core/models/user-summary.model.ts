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
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface UpdateMyProfileRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}
