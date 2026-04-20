using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;

namespace FinTreX.WebApi.Controllers.v1
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class CryptoController : ControllerBase
    {
        private readonly IMarketDataCache _marketDataCache;

        public CryptoController(IMarketDataCache marketDataCache)
        {
            _marketDataCache = marketDataCache;
        }

        [HttpGet]
        public IActionResult GetAll([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            if (page < 1) page = 1;
            if (size < 1 || size > 100) size = 20;

            var all = _marketDataCache.GetAllCrypto()
                .OrderByDescending(x => x.Volume24h * x.PriceUsdt)
                .ToList();

            var total = all.Count;
            var items = all
                .Skip((page - 1) * size)
                .Take(size)
                .Select(ToDto)
                .ToList();

            return Ok(new { total, page, size, items });
        }

        [HttpGet("all")]
        public IActionResult GetAllFlat()
        {
            var response = _marketDataCache.GetAllCrypto()
                .OrderByDescending(x => x.Volume24h * x.PriceUsdt)
                .Select(ToDto)
                .ToList();

            return Ok(response);
        }

        [HttpGet("top10")]
        public IActionResult GetTop10()
        {
            var response = _marketDataCache.GetAllCrypto()
                .OrderByDescending(x => x.Volume24h * x.PriceUsdt)
                .Take(10)
                .Select(ToDto)
                .ToList();

            return Ok(response);
        }

        [HttpGet("{symbol}")]
        public IActionResult GetBySymbol(string symbol)
        {
            var normalizedSymbol = NormalizeSymbol(symbol);
            if (string.IsNullOrWhiteSpace(normalizedSymbol))
            {
                return BadRequest("Symbol is required.");
            }

            var model = _marketDataCache.GetCrypto(normalizedSymbol);
            if (model is null)
            {
                return NotFound($"Crypto not found in cache: {normalizedSymbol}");
            }

            return Ok(ToDto(model));
        }

        private static CryptoPriceDto ToDto(FinTreX.Core.Models.MarketData.CryptoCurrency model) =>
            new()
            {
                Symbol = model.Symbol,
                BaseAsset = model.BaseAsset,
                PriceUsdt = model.PriceUsdt,
                PriceTry = model.PriceTry,
                ChangePercent1h = model.ChangePercent1h,
                ChangePercent4h = model.ChangePercent4h,
                ChangePercent24h = model.ChangePercent24h,
                MarketCapUsdt = model.MarketCapUsdt,
                CirculatingSupply = model.CirculatingSupply,
                TotalSupply = model.TotalSupply,
                Network = model.Network,
                Volume24h = model.Volume24h,
                TrySource = model.TrySource,
                UpdatedAt = model.UpdatedAt
            };

        private static string NormalizeSymbol(string symbol) =>
            (symbol ?? string.Empty).Trim().ToUpperInvariant();
    }
}
