using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Admin dashboard — live data fetched from the Stripe API (balance, payouts,
    /// fee breakdown, disputes) combined with DB-sourced card and failure analytics.
    /// All monetary values are in major units (TL).
    /// </summary>
    public class AdminDashboardStripeLiveDto
    {
        // ── Stripe Balance ─────────────────────────────────────────────────
        public StripeBalanceDto Balance { get; set; }

        // ── Recent Payouts ─────────────────────────────────────────────────
        public List<PayoutDto> RecentPayouts { get; set; } = new();

        // ── Stripe Fee Summary ─────────────────────────────────────────────
        public StripeFeesSummaryDto Fees { get; set; }

        // ── Disputes ───────────────────────────────────────────────────────
        public DisputeSummaryDto Disputes { get; set; }

        // ── Card Distribution (from DB) ────────────────────────────────────
        public List<CardDistributionItemDto> CardBrands { get; set; } = new();
        public List<CardDistributionItemDto> CardFunding { get; set; } = new();
        public List<CardDistributionItemDto> CardCountries { get; set; } = new();

        // ── Failure Analysis (from DB) ─────────────────────────────────────
        public FailureAnalysisDto FailureAnalysis { get; set; }
    }

    // ── Sub-DTOs ───────────────────────────────────────────────────────────

    public class StripeBalanceDto
    {
        public decimal Available { get; set; }
        public decimal Pending { get; set; }
        public string Currency { get; set; }
    }

    public class PayoutDto
    {
        public string Id { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; }
        public string Status { get; set; }
        public DateTime? ArrivalDate { get; set; }
        public DateTime Created { get; set; }
        public string Method { get; set; }
        public string Description { get; set; }
    }

    public class StripeFeesSummaryDto
    {
        public decimal TotalFeePaid { get; set; }
        public decimal TotalGross { get; set; }
        public decimal TotalNet { get; set; }
        public List<FeeBreakdownItemDto> ByType { get; set; } = new();
    }

    public class FeeBreakdownItemDto
    {
        public string Type { get; set; }
        public string Description { get; set; }
        public decimal Amount { get; set; }
    }

    public class DisputeSummaryDto
    {
        public int OpenCount { get; set; }
        public decimal OpenAmount { get; set; }
        public int WonCount { get; set; }
        public int LostCount { get; set; }
        public decimal DisputeRatePercent { get; set; }
    }

    public class CardDistributionItemDto
    {
        public string Label { get; set; }
        public int Count { get; set; }
        public decimal Percentage { get; set; }
    }

    public class FailureAnalysisDto
    {
        public int TotalFailedCount { get; set; }
        public decimal TotalFailedAmount { get; set; }
        public decimal SuccessRatePercent { get; set; }
        public int UncollectibleCount { get; set; }
        public decimal UncollectibleAmount { get; set; }
        public List<FailureCodeGroupDto> TopFailureCodes { get; set; } = new();
    }

    public class FailureCodeGroupDto
    {
        public string Code { get; set; }
        public string Message { get; set; }
        public int Count { get; set; }
    }
}
