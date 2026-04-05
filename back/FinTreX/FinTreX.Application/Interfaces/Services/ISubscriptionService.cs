using FinTreX.Core.DTOs.Subscription;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface ISubscriptionService
    {
        Task<IReadOnlyList<SubscriptionPlanDto>> GetPlansAsync(bool onlyActive = false);
        Task<UserSubscriptionDto> GetMySubscriptionAsync();
        Task<UserSubscriptionDto> UpgradePlanAsync(int planId);
        Task<bool> CancelSubscriptionAsync();
        Task<SubscriptionPlanDto> UpdatePlanAsync(int planId, UpdateSubscriptionPlanDto dto);
    }
}
