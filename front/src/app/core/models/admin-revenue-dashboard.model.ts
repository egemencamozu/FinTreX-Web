// ── Summary endpoint response ──────────────────────────────────────────

export interface AdminDashboardSummary {
  grossRevenue: number;
  netRevenue: number;
  totalRefunded: number;
  totalSalesCount: number;
  activeSubscriberCount: number;
  totalCustomerCount: number;
  mrr: number;
  arr: number;
  arpu: number;
  averageOrderValue: number;
  paymentSuccessRate: number;
  planBreakdowns: PlanBreakdown[];
  statusDistribution: StatusDistribution[];
}

export interface PlanBreakdown {
  planId: number;
  planDisplayName: string;
  planTier: string;
  totalSalesCount: number;
  totalRevenue: number;
  monthlySalesCount: number;
  monthlyRevenue: number;
  yearlySalesCount: number;
  yearlyRevenue: number;
  activeSubscriberCount: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  totalAmount: number;
}

// ── Trends endpoint response ───────────────────────────────────────────

export interface AdminDashboardTrends {
  monthlyRevenue: MonthlyRevenue[];
  subscriptions: SubscriptionAnalytics;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  label: string;
  grossRevenue: number;
  refunded: number;
  netRevenue: number;
  salesCount: number;
  newSubscriberCount: number;
}

export interface SubscriptionAnalytics {
  active: number;
  cancelPending: number;
  cancelled: number;
  churnRatePercent: number;
  upcomingRenewals: number;
  monthlyCount: number;
  yearlyCount: number;
}

// ── Stripe-live endpoint response ──────────────────────────────────────

export interface AdminDashboardStripeLive {
  balance: StripeBalance;
  recentPayouts: Payout[];
  fees: StripeFeesSummary;
  disputes: DisputeSummary;
  cardBrands: CardDistributionItem[];
  cardFunding: CardDistributionItem[];
  cardCountries: CardDistributionItem[];
  failureAnalysis: FailureAnalysis;
}

export interface StripeBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  created: string;
  method: string;
  description: string | null;
}

export interface StripeFeesSummary {
  totalFeePaid: number;
  totalGross: number;
  totalNet: number;
  byType: FeeBreakdownItem[];
}

export interface FeeBreakdownItem {
  type: string;
  description: string;
  amount: number;
}

export interface DisputeSummary {
  openCount: number;
  openAmount: number;
  wonCount: number;
  lostCount: number;
  disputeRatePercent: number;
}

export interface CardDistributionItem {
  label: string;
  count: number;
  percentage: number;
}

export interface FailureAnalysis {
  totalFailedCount: number;
  totalFailedAmount: number;
  successRatePercent: number;
  uncollectibleCount: number;
  uncollectibleAmount: number;
  topFailureCodes: FailureCodeGroup[];
}

export interface FailureCodeGroup {
  code: string;
  message: string;
  count: number;
}
