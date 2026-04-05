using FinTreX.Core.Entities;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IUserSubscriptionRepository : IGenericRepository<UserSubscription>
    {
        Task<UserSubscription> GetByUserIdAsync(string userId);
        Task<UserSubscription> GetWithPlanAsync(string userId);
    }
}
