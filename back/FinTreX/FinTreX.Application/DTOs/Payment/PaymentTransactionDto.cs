using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Payment record shown to the payer (USER role). Includes card snapshot
    /// and external URLs since the data belongs to them.
    /// </summary>
    public class PaymentTransactionDto
    {
        public int Id { get; set; }

        public string StripeInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }

        public int? SubscriptionPlanId { get; set; }
        public string? PlanDisplayName { get; set; }
        public SubscriptionTier? PlanTier { get; set; }

        public string? BillingPeriod { get; set; }

        // Amounts exposed as decimal in major units (e.g. 299.00 TRY) for UI simplicity.
        public decimal AmountPaid { get; set; }
        public decimal AmountDue { get; set; }
        public decimal Subtotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal RefundedAmount { get; set; }
        public string Currency { get; set; }

        public PaymentStatus Status { get; set; }

        public DateTime? PeriodStartUtc { get; set; }
        public DateTime? PeriodEndUtc { get; set; }
        public DateTime? PaidAtUtc { get; set; }
        public DateTime? RefundedAtUtc { get; set; }
        public DateTime CreatedAtUtc { get; set; }

        public string? HostedInvoiceUrl { get; set; }
        public string? ReceiptUrl { get; set; }

        public string? FailureCode { get; set; }
        public string? FailureMessage { get; set; }
    }
}
