using FinTreX.Core.DTOs.Subscription;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    // Optionally apply [Authorize(Roles = "Admin")] here or via attribute.
    // Assuming you have an Admin policy or role configured in the system.
    [Authorize(Roles = "Admin")]
    [Route("api/v1/admin/subscription-plans")]
    public class SubscriptionPlansAdminController : BaseApiController
    {
        private readonly ISubscriptionService _subscriptionService;

        public SubscriptionPlansAdminController(ISubscriptionService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPlans()
        {
            var plans = await _subscriptionService.GetPlansAsync(onlyActive: false);
            return Ok(plans);
        }

        [HttpPut("{planId}")]
        public async Task<IActionResult> UpdatePlan(int planId, [FromBody] UpdateSubscriptionPlanDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var updatedPlan = await _subscriptionService.UpdatePlanAsync(planId, dto);
                return Ok(updatedPlan);
            }
            catch (System.Collections.Generic.KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}
