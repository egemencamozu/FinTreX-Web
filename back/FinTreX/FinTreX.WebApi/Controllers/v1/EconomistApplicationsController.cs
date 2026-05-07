using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize(Roles = "Economist")]
    [Route("api/v1/economist-applications")]
    public class EconomistApplicationsController : BaseApiController
    {
        private readonly IEconomistApplicationService _service;

        public EconomistApplicationsController(IEconomistApplicationService service)
        {
            _service = service;
        }

        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] SubmitEconomistApplicationRequest request)
        {
            var result = await _service.SubmitAsync(request);
            return Ok(result);
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyLatest()
        {
            var result = await _service.GetMyLatestAsync();
            if (result == null) return NoContent();
            return Ok(result);
        }

    }
}
