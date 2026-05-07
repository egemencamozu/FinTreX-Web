using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IUserSubscriptionRepository : IGenericRepository<UserSubscription>
    {
        Task<UserSubscription> GetByUserIdAsync(string userId);
        Task<UserSubscription> GetWithPlanAsync(string userId);

        /// <summary>Every subscription row that has a Stripe customer id — used by the backfill job.</summary>
        Task<IReadOnlyList<UserSubscription>> GetAllWithStripeCustomerAsync();

        /// <summary>
        /// Sets the subscription's plan and billing period using a raw SQL UPDATE.
        /// Bypasses EF change-tracking so callers don't need to worry about
        /// NoTracking/Attach edge cases. Returns the number of rows affected.
        /// </summary>
        Task<int> SetPlanAsync(string userId, int planId, string billingPeriod);

        /// <summary>All subscription rows with plan navigation — used by dashboard analytics.</summary>
        Task<IReadOnlyList<UserSubscription>> GetAllWithPlanAsync();
    }
}
