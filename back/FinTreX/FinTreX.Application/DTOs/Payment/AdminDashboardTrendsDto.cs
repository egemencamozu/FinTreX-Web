using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Admin dashboard — monthly revenue trends (last 12 months) and subscription analytics.
    /// All monetary values are in major units (TL).
    /// </summary>
    public class AdminDashboardTrendsDto
    {
        public List<MonthlyRevenueDto> MonthlyRevenue { get; set; } = new();
        public SubscriptionAnalyticsDto Subscriptions { get; set; }
    }

    public class MonthlyRevenueDto
    {
        public int Year { get; set; }
        public int Month { get; set; }

        /// <summary>Formatted label, e.g. "2026-04".</summary>
        public string Label { get; set; }

        public decimal GrossRevenue { get; set; }
        public decimal Refunded { get; set; }
        public decimal NetRevenue { get; set; }
        public int SalesCount { get; set; }
        public int NewSubscriberCount { get; set; }
    }

    public class SubscriptionAnalyticsDto
    {
        public int Active { get; set; }
        public int CancelPending { get; set; }
        public int Cancelled { get; set; }
        public decimal ChurnRatePercent { get; set; }

        /// <summary>Subscriptions whose current period ends within 30 days.</summary>
        public int UpcomingRenewals { get; set; }

        public int MonthlyCount { get; set; }
        public int YearlyCount { get; set; }
    }
}
