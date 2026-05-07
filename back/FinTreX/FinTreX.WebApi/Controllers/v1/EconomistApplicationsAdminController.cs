using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize(Roles = "Admin")]
    [Route("api/v1/admin/economist-applications")]
    public class EconomistApplicationsAdminController : BaseApiController
    {
        private readonly IEconomistApplicationService _service;

        public EconomistApplicationsAdminController(IEconomistApplicationService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> List(
            [FromQuery] EconomistStatus? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _service.AdminListAsync(status, page, pageSize);
            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Detail(int id)
        {
            var result = await _service.AdminGetDetailAsync(id);
            return Ok(result);
        }

        [HttpPost("{id:int}/review")]
        public async Task<IActionResult> Review(int id, [FromBody] AdminReviewApplicationRequest request)
        {
            var result = await _service.AdminReviewAsync(id, request);
            return Ok(result);
        }

    }
}
