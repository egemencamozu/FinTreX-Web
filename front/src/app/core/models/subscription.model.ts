import { SubscriptionTier } from '../enums/subscription-tier.enum';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'expired';
  currentPeriodEnd: Date;
}
