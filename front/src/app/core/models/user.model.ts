import { UserRole } from '../enums/user-role.enum';
import { SubscriptionTier } from '../enums/subscription-tier.enum';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  avatarUrl?: string;
}
