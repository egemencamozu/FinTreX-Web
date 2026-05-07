using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using FinTreX.Core.Wrappers;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
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
    /// Hybrid read-model for payment history:
    ///  - List/detail queries are served from the local PaymentTransactions table (fast).
    ///  - Rows are populated by Stripe webhooks (live) and by the admin backfill
    ///    endpoint (one-time import of historical invoices).
    ///
    /// ADMIN payloads never carry card/receipt/invoice-url data — that mapping
    /// is enforced in <see cref="PaymentMapper"/> and cannot be bypassed by callers.
    /// </summary>
    public class PaymentHistoryService : IPaymentHistoryService
    {
        private const int MaxPageSize = 100;

        private readonly IPaymentTransactionRepository _paymentRepo;
        private readonly IUserSubscriptionRepository _subRepo;
        private readonly IGenericRepository<SubscriptionPlan> _planRepo;
        private readonly ICurrentUserService _currentUser;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly StripeSettings _stripeSettings;
        private readonly ILogger<PaymentHistoryService> _logger;

        public PaymentHistoryService(
            IPaymentTransactionRepository paymentRepo,
            IUserSubscriptionRepository subRepo,
            IGenericRepository<SubscriptionPlan> planRepo,
            ICurrentUserService currentUser,
            UserManager<ApplicationUser> userManager,
            IOptions<StripeSettings> stripeSettings,
            ILogger<PaymentHistoryService> logger)
        {
            _paymentRepo = paymentRepo;
            _subRepo = subRepo;
            _planRepo = planRepo;
            _currentUser = currentUser;
            _userManager = userManager;
            _stripeSettings = stripeSettings.Value;
            _logger = logger;
        }

        // ── USER ──────────────────────────────────────────────────────────────

        public async Task<PagedResponse<PaymentTransactionDto>> GetMyPaymentsAsync(int pageNumber, int pageSize)
        {
            var userId = _currentUser.UserId;
            if (string.IsNullOrEmpty(userId))
                throw new UnauthorizedAccessException("No authenticated user.");

            (pageNumber, pageSize) = NormalizePaging(pageNumber, pageSize);

            var (items, total) = await _paymentRepo.GetPagedByUserAsync(userId, pageNumber, pageSize);
            var data = items.Select(PaymentMapper.ToUserDto).ToList();
            return new PagedResponse<PaymentTransactionDto>(data, pageNumber, pageSize, total);
        }

        public async Task<PaymentTransactionDto> GetMyPaymentByIdAsync(int id)
        {
            var userId = _currentUser.UserId;
            if (string.IsNullOrEmpty(userId))
                throw new UnauthorizedAccessException("No authenticated user.");

            var tx = await _paymentRepo.GetByIdForUserAsync(id, userId);
            if (tx == null)
                throw new KeyNotFoundException("Payment transaction not found.");

            return PaymentMapper.ToUserDto(tx);
        }

        // ── ADMIN ─────────────────────────────────────────────────────────────

        public async Task<PagedResponse<AdminPaymentTransactionDto>> GetAllPaymentsAsync(int pageNumber, int pageSize)
        {
            (pageNumber, pageSize) = NormalizePaging(pageNumber, pageSize);

            var (items, total) = await _paymentRepo.GetAllPagedAsync(pageNumber, pageSize);

            // Batch-load user identity columns to enrich admin rows without N+1.
            var userIds = items.Select(x => x.ApplicationUserId).Distinct().ToList();
            var userLookup = _userManager.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionary(u => u.Id, u => (u.Email, u.FirstName, u.LastName));

            var data = items.Select(tx =>
            {
                var dto = PaymentMapper.ToAdminDto(tx);
                if (userLookup.TryGetValue(tx.ApplicationUserId, out var info))
                {
                    dto.UserEmail = info.Email;
                    dto.UserFullName = $"{info.FirstName} {info.LastName}".Trim();
                }
                return dto;
            }).ToList();

            return new PagedResponse<AdminPaymentTransactionDto>(data, pageNumber, pageSize, total);
        }

        public async Task<AdminPaymentTransactionDto> GetPaymentByIdForAdminAsync(int id)
        {
            var tx = await _paymentRepo.GetByIdWithPlanAsync(id);
            if (tx == null)
                throw new KeyNotFoundException("Payment transaction not found.");

            var dto = PaymentMapper.ToAdminDto(tx);
            var user = await _userManager.FindByIdAsync(tx.ApplicationUserId);
            if (user != null)
            {
                dto.UserEmail = user.Email;
                dto.UserFullName = $"{user.FirstName} {user.LastName}".Trim();
            }
            return dto;
        }

        // ── Backfill ──────────────────────────────────────────────────────────

        public async Task<BackfillResultDto> BackfillFromStripeAsync(string? userId = null)
        {
            StripeConfiguration.ApiKey = _stripeSettings.SecretKey;

            var subs = await _subRepo.GetAllWithStripeCustomerAsync();
            if (!string.IsNullOrEmpty(userId))
                subs = subs.Where(s => s.ApplicationUserId == userId).ToList();

            var plans = await _planRepo.GetAllAsync();
            var planByStripePrice = new Dictionary<string, SubscriptionPlan>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in plans)
            {
                if (!string.IsNullOrEmpty(p.StripeMonthlyPriceId)) planByStripePrice[p.StripeMonthlyPriceId] = p;
                if (!string.IsNullOrEmpty(p.StripeYearlyPriceId)) planByStripePrice[p.StripeYearlyPriceId] = p;
            }

            var invoiceService = new InvoiceService();
            var result = new BackfillResultDto();

            foreach (var sub in subs)
            {
                result.UsersProcessed++;

                var listOptions = new InvoiceListOptions
                {
                    Customer = sub.StripeCustomerId,
                    Limit = 100,
                    // Expandable fields default to id-only. We need the full objects for
                    // plan resolution (line price) and for card/receipt extraction (payments).
                    Expand = new List<string>
                    {
                        "data.payments",
                        "data.lines.data.pricing.price_details.price"
                    }
                };

                StripeList<Invoice> page;
                string startingAfter = null;

                do
                {
                    listOptions.StartingAfter = startingAfter;

                    try
                    {
                        page = await invoiceService.ListAsync(listOptions);
                    }
                    catch (StripeException ex)
                    {
                        _logger.LogWarning(ex,
                            "Stripe invoice list failed for customer {CustomerId}, user {UserId}",
                            sub.StripeCustomerId, sub.ApplicationUserId);
                        break;
                    }

                    foreach (var invoice in page.Data)
                    {
                        result.InvoicesScanned++;

                        try
                        {
                            var (changed, inserted) = await UpsertFromStripeInvoiceAsync(
                                invoice, sub.ApplicationUserId, planByStripePrice);

                            if (inserted) result.RecordsInserted++;
                            else if (changed) result.RecordsUpdated++;
                            else result.RecordsSkipped++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex,
                                "Backfill failed for invoice {InvoiceId} (user {UserId})",
                                invoice.Id, sub.ApplicationUserId);
                        }
                    }

                    startingAfter = page.HasMore && page.Data.Count > 0
                        ? page.Data[page.Data.Count - 1].Id
                        : null;
                } while (startingAfter != null);
            }

            return result;
        }

        /// <summary>
        /// Idempotent upsert used by both the backfill loop and the webhook handlers.
        /// Returns (changed, inserted). Changed=false means the row already matched.
        /// </summary>
        internal async Task<(bool changed, bool inserted)> UpsertFromStripeInvoiceAsync(
            Invoice invoice,
            string applicationUserId,
            IReadOnlyDictionary<string, SubscriptionPlan> planByStripePrice)
        {
            if (string.IsNullOrEmpty(invoice.Id))
                return (false, false);

            var existing = await _paymentRepo.GetByStripeInvoiceIdAsync(invoice.Id);

            // Resolve plan from the first line item's price id when possible.
            // In Stripe.NET v51, the price id is exposed via Pricing.PriceDetails.Price.
            int? planId = null;
            string billingPeriod = null;
            var firstLine = invoice.Lines?.Data?.FirstOrDefault();
            // In Stripe.NET v51, PriceDetails.Price is a Price object — take its Id.
            var priceId = firstLine?.Pricing?.PriceDetails?.Price?.Id;
            if (!string.IsNullOrEmpty(priceId) && planByStripePrice.TryGetValue(priceId, out var plan))
            {
                planId = plan.Id;
                if (string.Equals(plan.StripeYearlyPriceId, priceId, StringComparison.OrdinalIgnoreCase))
                    billingPeriod = "yearly";
                else if (string.Equals(plan.StripeMonthlyPriceId, priceId, StringComparison.OrdinalIgnoreCase))
                    billingPeriod = "monthly";
            }

            var status = MapInvoiceStatus(invoice);

            var (periodStart, periodEnd) = GetInvoicePeriod(invoice);

            var paidAt = invoice.StatusTransitions?.PaidAt;

            var subId = ExtractSubscriptionIdFromInvoice(invoice);

            // Card details are intentionally not fetched — users can see them on the
            // Stripe hosted invoice page. We still capture the payment/charge refs for
            // refund webhook lookups.
            var firstPayment = invoice.Payments?.Data?.FirstOrDefault()?.Payment;
            var paymentIntentId = firstPayment?.PaymentIntent?.Id;
            var chargeId = firstPayment?.Charge?.Id;

            if (existing == null)
            {
                var tx = new PaymentTransaction
                {
                    ApplicationUserId = applicationUserId,
                    SubscriptionPlanId = planId,
                    StripeInvoiceId = invoice.Id,
                    StripePaymentIntentId = paymentIntentId,
                    StripeChargeId = chargeId,
                    StripeSubscriptionId = subId,
                    StripeCustomerId = invoice.CustomerId,
                    InvoiceNumber = invoice.Number,
                    AmountPaid = invoice.AmountPaid,
                    AmountDue = invoice.AmountDue,
                    Subtotal = invoice.Subtotal,
                    TaxAmount = 0 /* tax captured via Stripe Tax line items if enabled — not wired yet */,
                    DiscountAmount = invoice.TotalDiscountAmounts?.Sum(d => d.Amount) ?? 0,
                    RefundedAmount = 0,
                    Currency = (invoice.Currency ?? "").ToLowerInvariant(),
                    Status = status,
                    BillingPeriod = billingPeriod,
                    PeriodStartUtc = periodStart,
                    PeriodEndUtc = periodEnd,
                    PaidAtUtc = paidAt,
                    HostedInvoiceUrl = invoice.HostedInvoiceUrl,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                await _paymentRepo.AddAsync(tx);
                return (true, true);
            }

            // Update mutable fields. Status transitions forward; card snapshot only
            // overwrites when we actually fetched something new (don't wipe it).
            existing.SubscriptionPlanId = planId ?? existing.SubscriptionPlanId;
            existing.Status = status;
            existing.AmountPaid = invoice.AmountPaid;
            existing.AmountDue = invoice.AmountDue;
            existing.Subtotal = invoice.Subtotal;
            existing.TaxAmount = 0 /* tax captured via Stripe Tax line items if enabled — not wired yet */;
            existing.DiscountAmount = invoice.TotalDiscountAmounts?.Sum(d => d.Amount) ?? 0;
            existing.BillingPeriod = billingPeriod ?? existing.BillingPeriod;
            existing.PeriodStartUtc = periodStart ?? existing.PeriodStartUtc;
            existing.PeriodEndUtc = periodEnd ?? existing.PeriodEndUtc;
            existing.PaidAtUtc = paidAt ?? existing.PaidAtUtc;
            existing.InvoiceNumber = invoice.Number ?? existing.InvoiceNumber;
            existing.HostedInvoiceUrl = invoice.HostedInvoiceUrl ?? existing.HostedInvoiceUrl;
            existing.StripeSubscriptionId = subId ?? existing.StripeSubscriptionId;
            existing.StripeCustomerId = invoice.CustomerId ?? existing.StripeCustomerId;

            if (!string.IsNullOrEmpty(paymentIntentId)) existing.StripePaymentIntentId = paymentIntentId;
            if (!string.IsNullOrEmpty(chargeId)) existing.StripeChargeId = chargeId;

            existing.UpdatedAtUtc = DateTime.UtcNow;

            await _paymentRepo.UpdateAsync(existing);
            return (true, false);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static (int pageNumber, int pageSize) NormalizePaging(int pageNumber, int pageSize)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > MaxPageSize) pageSize = MaxPageSize;
            return (pageNumber, pageSize);
        }

        private static PaymentStatus MapInvoiceStatus(Invoice invoice)
        {
            // Stripe invoice statuses: draft, open, paid, uncollectible, void
            switch (invoice.Status)
            {
                case "paid":
                    // Paid can still be fully/partially refunded — caller updates Refund* fields later.
                    return PaymentStatus.Paid;
                case "uncollectible":
                    return PaymentStatus.Uncollectible;
                case "void":
                    return PaymentStatus.Void;
                case "open":
                    return PaymentStatus.Open;
                default:
                    return PaymentStatus.Open;
            }
        }

        private static (DateTime? start, DateTime? end) GetInvoicePeriod(Invoice invoice)
        {
            var line = invoice.Lines?.Data?.FirstOrDefault();
            if (line?.Period == null) return (null, null);
            return (line.Period.Start, line.Period.End);
        }

        private static string ExtractSubscriptionIdFromInvoice(Invoice invoice)
        {
            var line = invoice.Lines?.Data?.FirstOrDefault();
            var subId = line?.Parent?.SubscriptionItemDetails?.Subscription;
            if (!string.IsNullOrEmpty(subId)) return subId;
            return invoice.Parent?.SubscriptionDetails?.SubscriptionId;
        }

    }
}
