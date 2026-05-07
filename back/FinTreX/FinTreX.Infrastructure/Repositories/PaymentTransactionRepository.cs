using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class PaymentTransactionRepository : GenericRepository<PaymentTransaction>, IPaymentTransactionRepository
    {
        public PaymentTransactionRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<PaymentTransaction> GetByStripeInvoiceIdAsync(string stripeInvoiceId)
        {
            return await _dbContext.PaymentTransactions
                .FirstOrDefaultAsync(x => x.StripeInvoiceId == stripeInvoiceId);
        }

        public async Task<PaymentTransaction> GetByStripeChargeIdAsync(string stripeChargeId)
        {
            return await _dbContext.PaymentTransactions
                .FirstOrDefaultAsync(x => x.StripeChargeId == stripeChargeId);
        }

        public async Task<(IReadOnlyList<PaymentTransaction> Items, int Total)> GetPagedByUserAsync(
            string userId, int pageNumber, int pageSize)
        {
            var query = _dbContext.PaymentTransactions
                .Where(x => x.ApplicationUserId == userId);

            var total = await query.CountAsync();

            var items = await query
                .Include(x => x.SubscriptionPlan)
                // Newest first; CreatedAtUtc is a fallback for rows whose payment never settled.
                .OrderByDescending(x => x.PaidAtUtc ?? x.CreatedAtUtc)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<(IReadOnlyList<PaymentTransaction> Items, int Total)> GetAllPagedAsync(
            int pageNumber, int pageSize)
        {
            var query = _dbContext.PaymentTransactions.AsQueryable();
            var total = await query.CountAsync();

            var items = await query
                .Include(x => x.SubscriptionPlan)
                .OrderByDescending(x => x.PaidAtUtc ?? x.CreatedAtUtc)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<PaymentTransaction> GetByIdForUserAsync(int id, string userId)
        {
            return await _dbContext.PaymentTransactions
                .Include(x => x.SubscriptionPlan)
                .FirstOrDefaultAsync(x => x.Id == id && x.ApplicationUserId == userId);
        }

        public async Task<PaymentTransaction> GetByIdWithPlanAsync(int id)
        {
            return await _dbContext.PaymentTransactions
                .Include(x => x.SubscriptionPlan)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<IReadOnlyList<PaymentTransaction>> GetAllForDashboardAsync()
        {
            return await _dbContext.PaymentTransactions
                .Include(x => x.SubscriptionPlan)
                .OrderByDescending(x => x.PaidAtUtc ?? x.CreatedAtUtc)
                .ToListAsync();
        }
    }
}
