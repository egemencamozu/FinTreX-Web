using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Admin dashboard — summary KPIs, plan breakdown, and payment status distribution.
    /// All monetary values are in major units (TL).
    /// </summary>
    public class AdminDashboardSummaryDto
    {
        // ── KPI Cards ──────────────────────────────────────────────────────
        public decimal GrossRevenue { get; set; }
        public decimal NetRevenue { get; set; }
        public decimal TotalRefunded { get; set; }
        public int TotalSalesCount { get; set; }
        public int ActiveSubscriberCount { get; set; }
        public int TotalCustomerCount { get; set; }
        public decimal Mrr { get; set; }
        public decimal Arr { get; set; }
        public decimal Arpu { get; set; }
        public decimal AverageOrderValue { get; set; }
        public decimal PaymentSuccessRate { get; set; }

        // ── Plan Breakdown ─────────────────────────────────────────────────
        public List<PlanBreakdownDto> PlanBreakdowns { get; set; } = new();

        // ── Status Distribution ────────────────────────────────────────────
        public List<StatusDistributionDto> StatusDistribution { get; set; } = new();
    }

    public class PlanBreakdownDto
    {
        public int PlanId { get; set; }
        public string PlanDisplayName { get; set; }
        public string PlanTier { get; set; }
        public int TotalSalesCount { get; set; }
        public decimal TotalRevenue { get; set; }
        public int MonthlySalesCount { get; set; }
        public decimal MonthlyRevenue { get; set; }
        public int YearlySalesCount { get; set; }
        public decimal YearlyRevenue { get; set; }
        public int ActiveSubscriberCount { get; set; }
    }

    public class StatusDistributionDto
    {
        public string Status { get; set; }
        public int Count { get; set; }
        public decimal TotalAmount { get; set; }
    }
}
