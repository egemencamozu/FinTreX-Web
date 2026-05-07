using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.Entities;

namespace FinTreX.Infrastructure.Services
{
    /// <summary>
    /// Maps <see cref="PaymentTransaction"/> entities to presentation DTOs.
    ///
    /// Security boundary: <see cref="ToAdminDto"/> must NEVER populate card fields,
    /// hosted invoice URL, or receipt URL. Admin users are explicitly blocked from
    /// viewing payment instruments and any link that would expose them.
    /// </summary>
    internal static class PaymentMapper
    {
        public static PaymentTransactionDto ToUserDto(PaymentTransaction x)
        {
            return new PaymentTransactionDto
            {
                Id = x.Id,
                StripeInvoiceId = x.StripeInvoiceId,
                InvoiceNumber = x.InvoiceNumber,
                SubscriptionPlanId = x.SubscriptionPlanId,
                PlanDisplayName = x.SubscriptionPlan?.DisplayName,
                PlanTier = x.SubscriptionPlan?.Tier,
                BillingPeriod = x.BillingPeriod,
                AmountPaid = ToMajorUnit(x.AmountPaid),
                AmountDue = ToMajorUnit(x.AmountDue),
                Subtotal = ToMajorUnit(x.Subtotal),
                TaxAmount = ToMajorUnit(x.TaxAmount),
                DiscountAmount = ToMajorUnit(x.DiscountAmount),
                RefundedAmount = ToMajorUnit(x.RefundedAmount),
                Currency = x.Currency,
                Status = x.Status,
                PeriodStartUtc = x.PeriodStartUtc,
                PeriodEndUtc = x.PeriodEndUtc,
                PaidAtUtc = x.PaidAtUtc,
                RefundedAtUtc = x.RefundedAtUtc,
                CreatedAtUtc = x.CreatedAtUtc,
                HostedInvoiceUrl = x.HostedInvoiceUrl,
                ReceiptUrl = x.ReceiptUrl,
                FailureCode = x.FailureCode,
                FailureMessage = x.FailureMessage
            };
        }

        public static AdminPaymentTransactionDto ToAdminDto(PaymentTransaction x)
        {
            return new AdminPaymentTransactionDto
            {
                Id = x.Id,
                ApplicationUserId = x.ApplicationUserId,
                StripeInvoiceId = x.StripeInvoiceId,
                InvoiceNumber = x.InvoiceNumber,
                SubscriptionPlanId = x.SubscriptionPlanId,
                PlanDisplayName = x.SubscriptionPlan?.DisplayName,
                PlanTier = x.SubscriptionPlan?.Tier,
                BillingPeriod = x.BillingPeriod,
                AmountPaid = ToMajorUnit(x.AmountPaid),
                AmountDue = ToMajorUnit(x.AmountDue),
                Subtotal = ToMajorUnit(x.Subtotal),
                TaxAmount = ToMajorUnit(x.TaxAmount),
                DiscountAmount = ToMajorUnit(x.DiscountAmount),
                RefundedAmount = ToMajorUnit(x.RefundedAmount),
                Currency = x.Currency,
                Status = x.Status,
                PeriodStartUtc = x.PeriodStartUtc,
                PeriodEndUtc = x.PeriodEndUtc,
                PaidAtUtc = x.PaidAtUtc,
                RefundedAtUtc = x.RefundedAtUtc,
                CreatedAtUtc = x.CreatedAtUtc,
                FailureCode = x.FailureCode,
                FailureMessage = x.FailureMessage
                // Card*, HostedInvoiceUrl, ReceiptUrl intentionally omitted.
            };
        }

        /// <summary>Converts minor units (kuruş/cent) to major units (TL/USD) for UI display.</summary>
        private static decimal ToMajorUnit(long amountMinor) => amountMinor / 100m;
    }
}
