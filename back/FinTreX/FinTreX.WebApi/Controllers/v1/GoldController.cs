using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using FinTreX.Infrastructure.Services.MarketData.Handlers;
using Microsoft.AspNetCore.Mvc;

namespace FinTreX.WebApi.Controllers.v1
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class GoldController : ControllerBase
    {
        private readonly IMarketDataCache _marketDataCache;
        private readonly GoldCalculator _goldCalculator;

        public GoldController(IMarketDataCache marketDataCache, GoldCalculator goldCalculator)
        {
            _marketDataCache = marketDataCache;
            _goldCalculator = goldCalculator;
        }

        [HttpGet("spot")]
        public IActionResult GetSpot()
        {
            var model = _marketDataCache.GetGold("XAUUSD=X");
            if (model is null)
            {
                return NotFound("Spot gold price is not available yet.");
            }

            return Ok(new GoldPriceDto
            {
                OunceUsd = model.OunceUsd,
                OunceTry = model.OunceTry,
                GramUsd = model.GramUsd,
                GramTry = model.GramTry,
                PriceQuality = model.PriceQuality,
                UpdatedAt = model.UpdatedAt
            });
        }

        [HttpGet("futures")]
        public IActionResult GetFutures()
        {
            var model = _marketDataCache.GetGold("GC=F");
            if (model is null)
            {
                return NotFound("Futures gold price is not available yet.");
            }

            return Ok(new GoldPriceDto
            {
                OunceUsd = model.OunceUsd,
                OunceTry = model.OunceTry,
                GramUsd = model.GramUsd,
                GramTry = model.GramTry,
                PriceQuality = model.PriceQuality,
                UpdatedAt = model.UpdatedAt
            });
        }

        [HttpGet("types")]
        public IActionResult GetTypes()
        {
            var source = _marketDataCache.GetGold("XAUUSD=X") ?? _marketDataCache.GetGold("GC=F");
            if (source is null)
            {
                return NotFound("Gold type prices are not available yet.");
            }

            return Ok(_goldCalculator.CalculateTypes(source.GramTry, source.UpdatedAt));
        }
    }
}
