using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class UserSubscriptionRepository : GenericRepository<UserSubscription>, IUserSubscriptionRepository
    {
        public UserSubscriptionRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<UserSubscription> GetByUserIdAsync(string userId)
        {
            return await _dbContext.UserSubscriptions
                .FirstOrDefaultAsync(x => x.ApplicationUserId == userId);
        }

        public async Task<UserSubscription> GetWithPlanAsync(string userId)
        {
            return await _dbContext.UserSubscriptions
                .Include(x => x.SubscriptionPlan)
                .FirstOrDefaultAsync(x => x.ApplicationUserId == userId);
        }

        public async Task<IReadOnlyList<UserSubscription>> GetAllWithStripeCustomerAsync()
        {
            return await _dbContext.UserSubscriptions
                .Where(x => x.StripeCustomerId != null && x.StripeCustomerId != "")
                .ToListAsync();
        }

        public Task<int> SetPlanAsync(string userId, int planId, string billingPeriod)
        {
            return _dbContext.UserSubscriptions
                .Where(x => x.ApplicationUserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.SubscriptionPlanId, planId)
                    .SetProperty(x => x.BillingPeriod, billingPeriod));
        }

        public async Task<IReadOnlyList<UserSubscription>> GetAllWithPlanAsync()
        {
            return await _dbContext.UserSubscriptions
                .Include(x => x.SubscriptionPlan)
                .ToListAsync();
        }
    }
}
