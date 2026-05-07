using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Admin-facing view of a payment. Card details, receipt URL and hosted invoice
    /// URL are INTENTIONALLY OMITTED — admins must not be able to view a user's
    /// payment instrument or receive a link that would expose it.
    /// </summary>
    public class AdminPaymentTransactionDto
    {
        public int Id { get; set; }

        public string ApplicationUserId { get; set; }
        public string? UserEmail { get; set; }
        public string? UserFullName { get; set; }

        public string StripeInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }

        public int? SubscriptionPlanId { get; set; }
        public string? PlanDisplayName { get; set; }
        public SubscriptionTier? PlanTier { get; set; }

        public string? BillingPeriod { get; set; }

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

        public string? FailureCode { get; set; }
        public string? FailureMessage { get; set; }
    }
}
