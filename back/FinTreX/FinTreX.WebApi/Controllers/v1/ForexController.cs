using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FinTreX.WebApi.Controllers.v1
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ForexController : ControllerBase
    {
        private readonly IMarketDataCache _marketDataCache;

        public ForexController(IMarketDataCache marketDataCache)
        {
            _marketDataCache = marketDataCache;
        }

        [HttpGet("usdtry")]
        public IActionResult GetUsdTry()
        {
            var model = _marketDataCache.GetForex("USDTRY");
            if (model is null)
            {
                return NotFound("USDTRY rate is not available yet.");
            }

            return Ok(new ForexRateDto
            {
                Pair = model.Pair,
                Rate = model.Rate,
                Source = model.Source,
                Quality = model.Quality == ForexQuality.Primary ? "PRIMARY" : "APPROXIMATE",
                UpdatedAt = model.UpdatedAt
            });
        }
    }
}
