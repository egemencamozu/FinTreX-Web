using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPaymentTransactionRepository : IGenericRepository<PaymentTransaction>
    {
        /// <summary>Lookup by Stripe invoice id — used by webhooks for idempotent upsert.</summary>
        Task<PaymentTransaction> GetByStripeInvoiceIdAsync(string stripeInvoiceId);

        /// <summary>Lookup by Stripe charge id — used by charge.refunded webhook.</summary>
        Task<PaymentTransaction> GetByStripeChargeIdAsync(string stripeChargeId);

        /// <summary>Paged history for a single user, newest-first. Plan is included.</summary>
        Task<(IReadOnlyList<PaymentTransaction> Items, int Total)> GetPagedByUserAsync(
            string userId, int pageNumber, int pageSize);

        /// <summary>Paged history across all users, newest-first. Plan is included.</summary>
        Task<(IReadOnlyList<PaymentTransaction> Items, int Total)> GetAllPagedAsync(
            int pageNumber, int pageSize);

        /// <summary>Fetch a specific transaction for a user (authorization guard).</summary>
        Task<PaymentTransaction> GetByIdForUserAsync(int id, string userId);

        /// <summary>Admin-scope fetch without user filter.</summary>
        Task<PaymentTransaction> GetByIdWithPlanAsync(int id);

        /// <summary>
        /// All transactions with a terminal status (Paid, Refunded, PartiallyRefunded,
        /// Failed, Uncollectible, Void) for dashboard aggregation. Plan is included.
        /// </summary>
        Task<IReadOnlyList<PaymentTransaction>> GetAllForDashboardAsync();
    }
}
