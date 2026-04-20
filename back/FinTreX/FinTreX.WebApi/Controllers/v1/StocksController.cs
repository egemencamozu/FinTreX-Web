using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Services.MarketData.Session;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class StocksController : ControllerBase
    {
        private readonly IMarketDataCache _marketDataCache;
        private readonly IDailyCloseRepository _dailyCloseRepository;
        private readonly MarketDataSettings _marketDataSettings;
        private readonly BistSessionManager _sessionManager;

        public StocksController(
            IMarketDataCache marketDataCache,
            IDailyCloseRepository dailyCloseRepository,
            IOptions<MarketDataSettings> marketDataSettings,
            BistSessionManager sessionManager)
        {
            _marketDataCache = marketDataCache;
            _dailyCloseRepository = dailyCloseRepository;
            _marketDataSettings = marketDataSettings.Value;
            _sessionManager = sessionManager;
        }

        [HttpGet]
        public IActionResult GetAll([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            if (page < 1) page = 1;
            if (size < 1 || size > 100) size = 20;

            var all = _marketDataCache.GetAllStocks()
                .OrderBy(x => x.Ticker)
                .ToList();

            var total = all.Count;
            var items = all
                .Skip((page - 1) * size)
                .Take(size)
                .Select(MapStock)
                .ToList();

            return Ok(new { total, page, size, items });
        }

        [HttpGet("bist")]
        public IActionResult GetBistAll()
        {
            var marketOpen = _sessionManager.GetCurrentState() != BistSessionState.Closed;

            var stocks = _marketDataCache.GetAllStocks()
                .OrderBy(x => x.Ticker)
                .Select(MapStock)
                .ToList();

            return Ok(new { marketOpen, items = stocks });
        }

        [HttpGet("bist30")]
        public IActionResult GetBist30()
        {
            var configuredTickers = (_marketDataSettings.Bist30Tickers ?? Enumerable.Empty<string>())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            var stocks = configuredTickers
                .Select(ticker => _marketDataCache.GetStock(ticker))
                .Where(stock => stock is not null)
                .Select(stock => MapStock(stock!))
                .ToList();

            var marketOpen = stocks.Count > 0;
            return Ok(new { marketOpen, items = stocks });
        }

        [HttpGet("{ticker}/history")]
        public async Task<IActionResult> GetHistory(string ticker)
        {
            var normalizedTicker = NormalizeTicker(ticker);
            if (string.IsNullOrWhiteSpace(normalizedTicker))
            {
                return BadRequest("Ticker is required.");
            }

            var history = await _dailyCloseRepository.GetByTickerAsync(normalizedTicker);

            var response = history
                .Select(x => new
                {
                    x.Ticker,
                    x.AssetType,
                    x.ClosePrice,
                    x.Change,
                    x.ChangePercent,
                    x.Volume,
                    x.Date,
                    x.WrittenAt
                })
                .ToList();

            return Ok(response);
        }

        [HttpGet("indices")]
        public IActionResult GetIndices()
        {
            var response = _marketDataCache.GetAllIndices()
                .Select(index => new IndexPriceDto
                {
                    Ticker = index.Ticker,
                    Name = index.Name,
                    Price = index.Price,
                    Change = index.Change,
                    ChangePercent = index.ChangePercent,
                    UpdatedAt = index.UpdatedAt
                })
                .OrderBy(x => x.Ticker)
                .ToList();

            return Ok(response);
        }

        [HttpGet("search")]
        public IActionResult Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Ok(Array.Empty<StockPriceDto>());
            }

            var query = q.Trim();
            var response = _marketDataCache.GetAllStocks()
                .Where(stock =>
                    stock.Ticker.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    stock.CompanyName.Contains(query, StringComparison.OrdinalIgnoreCase))
                .Select(MapStock)
                .OrderBy(x => x.Ticker)
                .ToList();

            return Ok(response);
        }

        [HttpGet("{ticker}")]
        public IActionResult GetByTicker(string ticker)
        {
            var normalizedTicker = NormalizeTicker(ticker);
            if (string.IsNullOrWhiteSpace(normalizedTicker))
            {
                return BadRequest("Ticker is required.");
            }

            var model = _marketDataCache.GetStock(normalizedTicker);
            if (model is null)
            {
                return NotFound($"Stock not found in cache: {normalizedTicker}");
            }

            return Ok(MapStock(model));
        }

        private static StockPriceDto MapStock(FinTreX.Core.Models.MarketData.StockPrice stock) =>
            new()
            {
                Ticker = stock.Ticker,
                CompanyName = stock.CompanyName,
                Sector = stock.Sector,
                Price = stock.Price,
                Change = stock.Change,
                ChangePercent = stock.ChangePercent,
                Volume = stock.Volume,
                UpdatedAt = stock.UpdatedAt
            };

        private static string NormalizeTicker(string ticker) =>
            (ticker ?? string.Empty).Trim().ToUpperInvariant();
    }
}
