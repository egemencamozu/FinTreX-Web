using FinTreX.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;

namespace FinTreX.Infrastructure.Services.MarketData.Routing
{
    public enum YahooStreamRouteType
    {
        Forex,
        Gold,
        BistIndex,
        BistStock,
        Unknown
    }

    public class YahooStreamRouter
    {
        private readonly HashSet<string> _indexTickers;
        private readonly HashSet<string> _goldTickers;
        private readonly HashSet<string> _forexTickers;
        private readonly ILogger<YahooStreamRouter> _logger;

        public YahooStreamRouter(
            IOptions<MarketDataSettings> settings,
            ILogger<YahooStreamRouter> logger)
        {
            _logger = logger;
            _indexTickers = BuildTickerSet(settings.Value.BistIndexTickers ?? new List<string>());
            _goldTickers = BuildTickerSet(settings.Value.GoldTickers ?? new List<string>());
            _forexTickers = BuildTickerSet(settings.Value.ForexTickers ?? new List<string>());
        }

        public YahooStreamRouteType ResolveRoute(string ticker)
        {
            if (string.IsNullOrWhiteSpace(ticker))
            {
                return YahooStreamRouteType.Unknown;
            }

            var normalizedTicker = ticker.Trim().ToUpperInvariant();

            if (_forexTickers.Contains(normalizedTicker))
            {
                return YahooStreamRouteType.Forex;
            }

            if (_goldTickers.Contains(normalizedTicker))
            {
                return YahooStreamRouteType.Gold;
            }

            if (normalizedTicker.EndsWith(".IS", StringComparison.Ordinal))
            {
                if (_indexTickers.Contains(normalizedTicker))
                {
                    return YahooStreamRouteType.BistIndex;
                }

                return YahooStreamRouteType.BistStock;
            }

            _logger.LogWarning("Yahoo router received unknown ticker: {Ticker}", normalizedTicker);
            return YahooStreamRouteType.Unknown;
        }

        private static HashSet<string> BuildTickerSet(IEnumerable<string> tickers)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var ticker in tickers)
            {
                if (string.IsNullOrWhiteSpace(ticker))
                {
                    continue;
                }

                set.Add(ticker.Trim().ToUpperInvariant());
            }

            return set;
        }
    }
}
