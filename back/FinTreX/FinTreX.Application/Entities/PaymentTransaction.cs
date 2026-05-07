using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Persisted record of a Stripe invoice/charge for the user's subscription.
    /// Written by Stripe webhooks (invoice.paid / payment_failed / charge.refunded)
    /// and by the admin backfill job that imports historical data from Stripe.
    /// </summary>
    public class PaymentTransaction
    {
        public int Id { get; set; }

        public string ApplicationUserId { get; set; }

        public int? SubscriptionPlanId { get; set; }

        // ── Stripe identifiers ─────────────────────────────────────────────
        /// <summary>Unique Stripe invoice id (e.g. "in_xxx"). Used as idempotency key.</summary>
        public string StripeInvoiceId { get; set; }

        public string? StripeChargeId { get; set; }
        public string? StripePaymentIntentId { get; set; }
        public string? StripeSubscriptionId { get; set; }
        public string? StripeCustomerId { get; set; }
        public string? InvoiceNumber { get; set; }

        // ── Amounts (stored in minor units — kuruş/cent — to avoid decimal drift) ──
        public long AmountPaid { get; set; }
        public long AmountDue { get; set; }
        public long Subtotal { get; set; }
        public long TaxAmount { get; set; }
        public long DiscountAmount { get; set; }
        public long RefundedAmount { get; set; }

        /// <summary>Lowercase ISO-4217 code as Stripe reports it (e.g. "try", "usd").</summary>
        public string Currency { get; set; }

        // ── Status / timing ────────────────────────────────────────────────
        public PaymentStatus Status { get; set; }

        /// <summary>"monthly" or "yearly".</summary>
        public string? BillingPeriod { get; set; }

        public DateTime? PeriodStartUtc { get; set; }
        public DateTime? PeriodEndUtc { get; set; }
        public DateTime? PaidAtUtc { get; set; }
        public DateTime? RefundedAtUtc { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

        // ── Card snapshot (USER only — never exposed to ADMIN DTOs) ────────
        public string? CardBrand { get; set; }
        public string? CardLast4 { get; set; }
        public int? CardExpMonth { get; set; }
        public int? CardExpYear { get; set; }
        public string? CardCountry { get; set; }
        public string? CardFunding { get; set; }

        // ── External URLs (USER only) ──────────────────────────────────────
        public string? HostedInvoiceUrl { get; set; }
        public string? ReceiptUrl { get; set; }

        // ── Failure details ────────────────────────────────────────────────
        public string? FailureCode { get; set; }
        public string? FailureMessage { get; set; }

        // ── Navigation ─────────────────────────────────────────────────────
        public SubscriptionPlan? SubscriptionPlan { get; set; }
    }
}
