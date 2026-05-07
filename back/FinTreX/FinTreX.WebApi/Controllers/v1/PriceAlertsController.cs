using System.Threading.Tasks;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class PriceAlertsController : BaseApiController
    {
        private readonly IPriceAlertService _alertService;

        public PriceAlertsController(IPriceAlertService alertService)
        {
            _alertService = alertService;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyAlerts([FromQuery] AlertStatus? status = null, [FromQuery] string? symbol = null)
        {
            var alerts = await _alertService.GetMyAlertsAsync(status, symbol);
            return Ok(alerts);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var alert = await _alertService.GetByIdAsync(id);
            return Ok(alert);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePriceAlertRequest request)
        {
            var created = await _alertService.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPatch("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdatePriceAlertRequest request)
        {
            var updated = await _alertService.UpdateAsync(id, request);
            return Ok(updated);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _alertService.DeleteAsync(id);
            if (!deleted) return NotFound("Alert not found.");
            return NoContent();
        }

        [HttpPost("{id:int}/pause")]
        public async Task<IActionResult> Pause(int id)
        {
            var dto = await _alertService.PauseAsync(id);
            return Ok(dto);
        }

        [HttpPost("{id:int}/resume")]
        public async Task<IActionResult> Resume(int id)
        {
            var dto = await _alertService.ResumeAsync(id);
            return Ok(dto);
        }
    }
}
