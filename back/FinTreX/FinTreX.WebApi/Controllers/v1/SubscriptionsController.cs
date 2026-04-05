using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Asp.Versioning;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class SubscriptionsController : BaseApiController
    {
        private readonly ISubscriptionService _subscriptionService;

        public SubscriptionsController(ISubscriptionService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        [HttpGet("plans")]
        [AllowAnonymous] // Allow viewing plans before logging in if needed
        public async Task<IActionResult> GetPlans()
        {
            var plans = await _subscriptionService.GetPlansAsync(onlyActive: true);
            return Ok(plans);
        }

        [HttpGet("my-subscription")]
        public async Task<IActionResult> GetMySubscription()
        {
            var sub = await _subscriptionService.GetMySubscriptionAsync();
            return Ok(sub);
        }

        [HttpPost("upgrade/{planId}")]
        public async Task<IActionResult> UpgradePlan(int planId)
        {
            var upgradedSub = await _subscriptionService.UpgradePlanAsync(planId);
            return Ok(upgradedSub);
        }

        [HttpPost("cancel")]
        public async Task<IActionResult> CancelSubscription()
        {
            var result = await _subscriptionService.CancelSubscriptionAsync();
            if (!result) return BadRequest("Could not cancel subscription.");
            return NoContent();
        }
    }
}
