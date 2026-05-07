using FinTreX.Core.Settings;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;

namespace FinTreX.WebApi.Controllers.v1
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class MetalsController : ControllerBase
    {
        private static readonly IReadOnlyDictionary<string, string> DefaultNames =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["XAU"] = "Altın",
                ["XAG"] = "Gümüş",
                ["XPT"] = "Platin",
                ["XPD"] = "Paladyum"
            };

        private readonly MarketDataSettings _settings;

        public MetalsController(IOptions<MarketDataSettings> settings)
        {
            _settings = settings.Value;
        }

        [HttpGet("symbols")]
        public IActionResult GetSymbols()
        {
            var symbols = (_settings.PreciousMetalSymbols ?? Enumerable.Empty<string>())
                .Where(symbol => !string.IsNullOrWhiteSpace(symbol))
                .Select(symbol => symbol.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(symbol => new
                {
                    symbol,
                    name = ResolveDisplayName(symbol)
                })
                .OrderBy(x => x.symbol)
                .ToList();

            return Ok(symbols);
        }

        private static string ResolveDisplayName(string symbol) =>
            DefaultNames.TryGetValue(symbol, out var displayName)
                ? displayName
                : symbol;
    }
}
