import { SubscriptionTier } from '../enums/subscription-tier.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

export interface PlanFeature {
  name: string;
  status: 'included' | 'excluded' | 'hidden';
}

export interface SubscriptionPlan {
  id: number;
  tier: SubscriptionTier;
  displayName: string;
  description: string;
  monthlyPriceTRY: number;
  yearlyPriceTRY: number;
  maxEconomists: number;
  canChangeEconomist: boolean;
  hasPrioritySupport: boolean;
  isActive: boolean;
  features: PlanFeature[];
}

export interface UserSubscription {
  id: number;
  applicationUserId: string;
  subscriptionPlanId: number;
  subscriptionPlan: SubscriptionPlan;
  status: SubscriptionStatus;
  startedAtUtc: string;
  currentPeriodEndUtc?: string;
  cancelledAtUtc?: string;
  createdAtUtc: string;
}

export interface UpdateSubscriptionPlanDto {
  displayName: string;
  description: string;
  monthlyPriceTRY: number;
  yearlyPriceTRY: number;
  maxEconomists: number;
  canChangeEconomist: boolean;
  hasPrioritySupport: boolean;
  isActive: boolean;
  features: PlanFeature[];
}

