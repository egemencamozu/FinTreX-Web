using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.DTOs.Subscription;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IStripePaymentService
    {
        Task<CheckoutSessionResponse> CreateCheckoutSessionAsync(int planId, string billingPeriod);
        Task HandleWebhookEventAsync(string json, string stripeSignature);
        Task<string> CreateCustomerPortalSessionAsync();
        Task<UserSubscriptionDto> VerifyCheckoutSessionAsync(string sessionId);
        Task CancelStripeSubscriptionAsync(bool atPeriodEnd = true);
    }
}
