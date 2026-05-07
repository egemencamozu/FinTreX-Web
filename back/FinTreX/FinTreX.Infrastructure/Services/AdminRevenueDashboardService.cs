using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    /// <summary>
    /// Aggregates revenue data from the local DB and live Stripe API
    /// for the admin dashboard. Three methods map to three endpoints
    /// so the frontend can call them in parallel.
    /// </summary>
    public class AdminRevenueDashboardService : IAdminRevenueDashboardService
    {
        private readonly IPaymentTransactionRepository _paymentRepo;
        private readonly IUserSubscriptionRepository _subRepo;
        private readonly IGenericRepository<SubscriptionPlan> _planRepo;
        private readonly StripeSettings _stripeSettings;
        private readonly ILogger<AdminRevenueDashboardService> _logger;

        public AdminRevenueDashboardService(
            IPaymentTransactionRepository paymentRepo,
            IUserSubscriptionRepository subRepo,
            IGenericRepository<SubscriptionPlan> planRepo,
            IOptions<StripeSettings> stripeSettings,
            ILogger<AdminRevenueDashboardService> logger)
        {
            _paymentRepo = paymentRepo;
            _subRepo = subRepo;
            _planRepo = planRepo;
            _stripeSettings = stripeSettings.Value;
            _logger = logger;

            if (string.IsNullOrEmpty(_stripeSettings?.SecretKey))
            {
                _logger.LogError("Stripe SecretKey is missing in configuration!");
            }
            else
            {
                StripeConfiguration.ApiKey = _stripeSettings.SecretKey;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  1. SUMMARY — DB-only, fast
        // ═══════════════════════════════════════════════════════════════════

        public async Task<AdminDashboardSummaryDto> GetSummaryAsync()
        {
            try
            {
                var allTx = await _paymentRepo.GetAllForDashboardAsync() ?? new List<PaymentTransaction>();
                var allSubs = await _subRepo.GetAllWithPlanAsync() ?? new List<UserSubscription>();
                var plans = await _planRepo.GetAllAsync() ?? new List<SubscriptionPlan>();

                // ── KPI calculations ───────────────────────────────────────────
                var paidTx = allTx.Where(t => t.Status == PaymentStatus.Paid
                                           || t.Status == PaymentStatus.Refunded
                                           || t.Status == PaymentStatus.PartiallyRefunded).ToList();

                var grossRevenue = paidTx.Sum(t => t.AmountPaid);
                var totalRefunded = allTx.Sum(t => t.RefundedAmount);
                var netRevenue = grossRevenue - totalRefunded;
                var totalSalesCount = paidTx.Count;

                var activeSubs = allSubs.Where(s => s.Status == SubscriptionStatus.Active).ToList();
                var activeSubscriberCount = activeSubs.Count;

                // Unique paying users
                var uniquePayingUsers = paidTx.Select(t => t.ApplicationUserId).Distinct().Count();
                var arpu = uniquePayingUsers > 0 ? ToMajor(netRevenue) / uniquePayingUsers : 0m;
                var avgOrderValue = totalSalesCount > 0 ? ToMajor(grossRevenue) / totalSalesCount : 0m;

                // MRR: sum of monthly plan prices for active subs
                decimal mrr = 0m;
                foreach (var sub in activeSubs)
                {
                    if (sub.SubscriptionPlan == null) continue;
                    if (sub.SubscriptionPlan.Tier == SubscriptionTier.Default) continue;

                    if (string.Equals(sub.BillingPeriod, "yearly", StringComparison.OrdinalIgnoreCase))
                        mrr += sub.SubscriptionPlan.YearlyPriceTRY / 12m;
                    else
                        mrr += sub.SubscriptionPlan.MonthlyPriceTRY;
                }

                // Success rate
                var failedCount = allTx.Count(t => t.Status == PaymentStatus.Failed);
                var totalAttempts = totalSalesCount + failedCount;
                var successRate = totalAttempts > 0 ? (decimal)totalSalesCount / totalAttempts * 100m : 100m;

                // ── Plan breakdown ─────────────────────────────────────────────
                var paidPlans = plans.Where(p => p.Tier != SubscriptionTier.Default).ToList();
                var planBreakdowns = paidPlans.Select(plan =>
                {
                    var planTx = paidTx.Where(t => t.SubscriptionPlanId == plan.Id).ToList();
                    var monthlyTx = planTx.Where(t => string.Equals(t.BillingPeriod, "monthly", StringComparison.OrdinalIgnoreCase)).ToList();
                    var yearlyTx = planTx.Where(t => string.Equals(t.BillingPeriod, "yearly", StringComparison.OrdinalIgnoreCase)).ToList();

                    return new PlanBreakdownDto
                    {
                        PlanId = plan.Id,
                        PlanDisplayName = plan.DisplayName,
                        PlanTier = plan.Tier.ToString(),
                        TotalSalesCount = planTx.Count,
                        TotalRevenue = ToMajor(planTx.Sum(t => t.AmountPaid)),
                        MonthlySalesCount = monthlyTx.Count,
                        MonthlyRevenue = ToMajor(monthlyTx.Sum(t => t.AmountPaid)),
                        YearlySalesCount = yearlyTx.Count,
                        YearlyRevenue = ToMajor(yearlyTx.Sum(t => t.AmountPaid)),
                        ActiveSubscriberCount = activeSubs.Count(s => s.SubscriptionPlanId == plan.Id)
                    };
                }).ToList();

                // ── Status distribution ────────────────────────────────────────
                var statusDistribution = allTx
                    .GroupBy(t => t.Status)
                    .Select(g => new StatusDistributionDto
                    {
                        Status = g.Key.ToString(),
                        Count = g.Count(),
                        TotalAmount = ToMajor(g.Sum(t => t.AmountPaid))
                    })
                    .OrderByDescending(s => s.Count)
                    .ToList();

                return new AdminDashboardSummaryDto
                {
                    GrossRevenue = ToMajor(grossRevenue),
                    NetRevenue = ToMajor(netRevenue),
                    TotalRefunded = ToMajor(totalRefunded),
                    TotalSalesCount = totalSalesCount,
                    ActiveSubscriberCount = activeSubscriberCount,
                    TotalCustomerCount = allSubs.Count,
                    Mrr = Math.Round(mrr, 2),
                    Arr = Math.Round(mrr * 12m, 2),
                    Arpu = Math.Round(arpu, 2),
                    AverageOrderValue = Math.Round(avgOrderValue, 2),
                    PaymentSuccessRate = Math.Round(successRate, 2),
                    PlanBreakdowns = planBreakdowns,
                    StatusDistribution = statusDistribution
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetSummaryAsync");
                throw;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  2. TRENDS — DB-only, fast
        // ═══════════════════════════════════════════════════════════════════

        public async Task<AdminDashboardTrendsDto> GetTrendsAsync()
        {
            try
            {
                var allTx = await _paymentRepo.GetAllForDashboardAsync() ?? new List<PaymentTransaction>();
                var allSubs = await _subRepo.GetAllWithPlanAsync() ?? new List<UserSubscription>();

                // ── Monthly revenue trend (last 12 months) ─────────────────────
                var now = DateTime.UtcNow;
                var twelveMonthsAgo = new DateTime(now.Year, now.Month, 1).AddMonths(-11);

                var paidTx = allTx.Where(t => t.Status == PaymentStatus.Paid
                                           || t.Status == PaymentStatus.Refunded
                                           || t.Status == PaymentStatus.PartiallyRefunded).ToList();

                var monthlyRevenue = new List<MonthlyRevenueDto>();
                for (int i = 0; i < 12; i++)
                {
                    var monthStart = twelveMonthsAgo.AddMonths(i);
                    var monthEnd = monthStart.AddMonths(1);

                    var monthTx = paidTx.Where(t => (t.PaidAtUtc ?? t.CreatedAtUtc) >= monthStart
                                                 && (t.PaidAtUtc ?? t.CreatedAtUtc) < monthEnd).ToList();

                    var monthRefunds = allTx.Where(t => t.RefundedAtUtc >= monthStart
                                                     && t.RefundedAtUtc < monthEnd).ToList();

                    var gross = monthTx.Sum(t => t.AmountPaid);
                    var refunded = monthRefunds.Sum(t => t.RefundedAmount);

                    // New subscribers: users whose first paid transaction falls in this month
                    var newSubCount = monthTx
                        .Where(t => !paidTx.Any(prev => prev.ApplicationUserId == t.ApplicationUserId
                                                     && (prev.PaidAtUtc ?? prev.CreatedAtUtc) < monthStart))
                        .Select(t => t.ApplicationUserId)
                        .Distinct()
                        .Count();

                    monthlyRevenue.Add(new MonthlyRevenueDto
                    {
                        Year = monthStart.Year,
                        Month = monthStart.Month,
                        Label = $"{monthStart.Year}-{monthStart.Month:D2}",
                        GrossRevenue = ToMajor(gross),
                        Refunded = ToMajor(refunded),
                        NetRevenue = ToMajor(gross - refunded),
                        SalesCount = monthTx.Count,
                        NewSubscriberCount = newSubCount
                    });
                }

                // ── Subscription analytics ─────────────────────────────────────
                var activeSubs = allSubs.Where(s => s.Status == SubscriptionStatus.Active).ToList();
                var cancelledSubs = allSubs.Where(s => s.Status == SubscriptionStatus.Cancelled).ToList();
                var cancelPending = activeSubs.Count(s => s.CancelAtPeriodEnd);

                var thirtyDaysFromNow = now.AddDays(30);
                var upcomingRenewals = activeSubs.Count(s =>
                    s.CurrentPeriodEndUtc.HasValue
                    && s.CurrentPeriodEndUtc.Value <= thirtyDaysFromNow
                    && !s.CancelAtPeriodEnd);

                // Churn rate: cancelled in last 30 days / active at start of period
                var recentCancelled = cancelledSubs.Count(s =>
                    s.CancelledAtUtc.HasValue && s.CancelledAtUtc.Value >= now.AddDays(-30));
                var churnBase = activeSubs.Count + recentCancelled;
                var churnRate = churnBase > 0 ? (decimal)recentCancelled / churnBase * 100m : 0m;

                var subscriptionAnalytics = new SubscriptionAnalyticsDto
                {
                    Active = activeSubs.Count,
                    CancelPending = cancelPending,
                    Cancelled = cancelledSubs.Count,
                    ChurnRatePercent = Math.Round(churnRate, 2),
                    UpcomingRenewals = upcomingRenewals,
                    MonthlyCount = activeSubs.Count(s => string.Equals(s.BillingPeriod, "monthly", StringComparison.OrdinalIgnoreCase)),
                    YearlyCount = activeSubs.Count(s => string.Equals(s.BillingPeriod, "yearly", StringComparison.OrdinalIgnoreCase))
                };

                return new AdminDashboardTrendsDto
                {
                    MonthlyRevenue = monthlyRevenue,
                    Subscriptions = subscriptionAnalytics
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetTrendsAsync");
                throw;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  3. STRIPE LIVE — Stripe API calls + DB card/failure analytics
        // ═══════════════════════════════════════════════════════════════════

        public async Task<AdminDashboardStripeLiveDto> GetStripeLiveAsync()
        {
            try
            {
                var dto = new AdminDashboardStripeLiveDto();

                // DB-based analytics - Fetch FIRST to avoid concurrent DbContext usage
                var allTx = await _paymentRepo.GetAllForDashboardAsync() ?? new List<PaymentTransaction>();
                var paidTxCount = allTx.Count(t => t.Status == PaymentStatus.Paid);

                // Run Stripe API calls in parallel
                var balanceTask = GetStripeBalanceAsync();
                var payoutsTask = GetRecentPayoutsAsync();
                var feesTask = GetStripeFeesSummaryAsync();
                var disputesTask = GetDisputeSummaryAsync(paidTxCount);

                await Task.WhenAll(balanceTask, payoutsTask, feesTask, disputesTask);

                dto.Balance = await balanceTask;
                dto.RecentPayouts = await payoutsTask;
                dto.Fees = await feesTask;
                dto.Disputes = await disputesTask;

                // ── Card distribution (from DB) ────────────────────────────────
                var txWithCard = allTx.Where(t => !string.IsNullOrEmpty(t.CardBrand)).ToList();
                var totalWithCard = txWithCard.Count;

                dto.CardBrands = GroupDistribution(txWithCard, t => t.CardBrand, totalWithCard);
                dto.CardFunding = GroupDistribution(txWithCard, t => t.CardFunding, totalWithCard);
                dto.CardCountries = GroupDistribution(txWithCard, t => t.CardCountry, totalWithCard);

                // ── Failure analysis (from DB) ─────────────────────────────────
                var failedTx = allTx.Where(t => t.Status == PaymentStatus.Failed).ToList();
                var uncollectibleTx = allTx.Where(t => t.Status == PaymentStatus.Uncollectible).ToList();
                var paidCount = allTx.Count(t => t.Status == PaymentStatus.Paid
                                              || t.Status == PaymentStatus.Refunded
                                              || t.Status == PaymentStatus.PartiallyRefunded);
                var totalAttempts = paidCount + failedTx.Count;

                dto.FailureAnalysis = new FailureAnalysisDto
                {
                    TotalFailedCount = failedTx.Count,
                    TotalFailedAmount = ToMajor(failedTx.Sum(t => t.AmountDue)),
                    SuccessRatePercent = totalAttempts > 0
                        ? Math.Round((decimal)paidCount / totalAttempts * 100m, 2)
                        : 100m,
                    UncollectibleCount = uncollectibleTx.Count,
                    UncollectibleAmount = ToMajor(uncollectibleTx.Sum(t => t.AmountDue)),
                    TopFailureCodes = failedTx
                        .Where(t => !string.IsNullOrEmpty(t.FailureCode))
                        .GroupBy(t => t.FailureCode)
                        .Select(g => new FailureCodeGroupDto
                        {
                            Code = g.Key,
                            Message = g.First().FailureMessage ?? "",
                            Count = g.Count()
                        })
                        .OrderByDescending(g => g.Count)
                        .Take(10)
                        .ToList()
                };

                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetStripeLiveAsync");
                throw;
            }
        }

        // ── Stripe API helpers ─────────────────────────────────────────────

        private async Task<StripeBalanceDto> GetStripeBalanceAsync()
        {
            try
            {
                var service = new BalanceService();
                var balance = await service.GetAsync();

                // Primary currency
                var available = balance.Available?.FirstOrDefault();
                var pending = balance.Pending?.FirstOrDefault();

                return new StripeBalanceDto
                {
                    Available = ToMajor(available?.Amount ?? 0),
                    Pending = ToMajor(pending?.Amount ?? 0),
                    Currency = (available?.Currency ?? pending?.Currency ?? "try").ToLowerInvariant()
                };
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Stripe balance");
                return new StripeBalanceDto { Currency = "try" };
            }
        }

        private async Task<List<PayoutDto>> GetRecentPayoutsAsync()
        {
            try
            {
                var service = new PayoutService();
                var payouts = await service.ListAsync(new PayoutListOptions { Limit = 10 });

                return payouts.Data.Select(p => new PayoutDto
                {
                    Id = p.Id,
                    Amount = ToMajor(p.Amount),
                    Currency = (p.Currency ?? "").ToLowerInvariant(),
                    Status = p.Status,
                    ArrivalDate = p.ArrivalDate,
                    Created = p.Created,
                    Method = p.Method,
                    Description = p.Description
                }).ToList();
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Stripe payouts");
                return new List<PayoutDto>();
            }
        }

        private async Task<StripeFeesSummaryDto> GetStripeFeesSummaryAsync()
        {
            try
            {
                var service = new BalanceTransactionService();
                var options = new BalanceTransactionListOptions
                {
                    Limit = 100,
                    Type = "charge"
                };

                var transactions = await service.ListAsync(options);

                long totalFee = 0;
                long totalGross = 0;
                long totalNet = 0;
                var feeByType = new Dictionary<string, (long amount, string desc)>(StringComparer.OrdinalIgnoreCase);

                foreach (var tx in transactions.Data)
                {
                    totalFee += tx.Fee;
                    totalGross += tx.Amount;
                    totalNet += tx.Net;

                    if (tx.FeeDetails != null)
                    {
                        foreach (var detail in tx.FeeDetails)
                        {
                            var type = detail.Type ?? "other";
                            if (feeByType.ContainsKey(type))
                                feeByType[type] = (feeByType[type].amount + detail.Amount, detail.Description ?? type);
                            else
                                feeByType[type] = (detail.Amount, detail.Description ?? type);
                        }
                    }
                }

                return new StripeFeesSummaryDto
                {
                    TotalFeePaid = ToMajor(totalFee),
                    TotalGross = ToMajor(totalGross),
                    TotalNet = ToMajor(totalNet),
                    ByType = feeByType.Select(kvp => new FeeBreakdownItemDto
                    {
                        Type = kvp.Key,
                        Description = kvp.Value.desc,
                        Amount = ToMajor(kvp.Value.amount)
                    }).OrderByDescending(f => f.Amount).ToList()
                };
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Stripe balance transactions");
                return new StripeFeesSummaryDto();
            }
        }

        private async Task<DisputeSummaryDto> GetDisputeSummaryAsync(int paidTxCount)
        {
            try
            {
                var service = new DisputeService();
                var disputes = await service.ListAsync(new DisputeListOptions { Limit = 100 });

                var openStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    { "warning_needs_response", "needs_response", "warning_under_review", "under_review" };
                var wonStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "won" };
                var lostStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "lost" };

                var openDisputes = disputes.Data.Where(d => openStatuses.Contains(d.Status)).ToList();
                var wonCount = disputes.Data.Count(d => wonStatuses.Contains(d.Status));
                var lostCount = disputes.Data.Count(d => lostStatuses.Contains(d.Status));

                // Dispute rate: total disputes / total charges (rough estimate from balance transactions)
                var totalCharges = disputes.Data.Count + wonCount + lostCount;
                
                var disputeRate = paidTxCount > 0
                    ? (decimal)disputes.Data.Count / paidTxCount * 100m
                    : 0m;

                return new DisputeSummaryDto
                {
                    OpenCount = openDisputes.Count,
                    OpenAmount = ToMajor(openDisputes.Sum(d => d.Amount)),
                    WonCount = wonCount,
                    LostCount = lostCount,
                    DisputeRatePercent = Math.Round(disputeRate, 4)
                };
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Stripe disputes");
                return new DisputeSummaryDto();
            }
        }

        // ── Utility ────────────────────────────────────────────────────────

        /// <summary>Converts minor units (kuruş/cent) to major units (TL/USD).</summary>
        private static decimal ToMajor(long amountMinor) => amountMinor / 100m;

        private static List<CardDistributionItemDto> GroupDistribution(
            List<PaymentTransaction> items,
            Func<PaymentTransaction, string> selector,
            int total)
        {
            return items
                .GroupBy(t => selector(t) ?? "unknown")
                .Select(g => new CardDistributionItemDto
                {
                    Label = g.Key,
                    Count = g.Count(),
                    Percentage = total > 0 ? Math.Round((decimal)g.Count() / total * 100m, 2) : 0m
                })
                .OrderByDescending(c => c.Count)
                .ToList();
        }
    }
}
