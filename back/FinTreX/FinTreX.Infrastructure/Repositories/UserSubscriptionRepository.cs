using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
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
    }
}
