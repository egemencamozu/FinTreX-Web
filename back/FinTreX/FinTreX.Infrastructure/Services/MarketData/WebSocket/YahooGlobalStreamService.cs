using FinTreX.Core.Settings;
using FinTreX.Core.Interfaces;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Decode;
using FinTreX.Infrastructure.Services.MarketData.Handlers;
using FinTreX.Infrastructure.Services.MarketData.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.WebSocket
{
#nullable enable
    /// <summary>
    /// 24/7 Yahoo stream for global forex instruments.
    /// Gold is sourced from Binance only.
    /// </summary>
    public sealed class YahooGlobalStreamService : YahooWebSocketBase
    {
        private static readonly SocketsHttpHandler QuoteHttpHandler = new()
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2)
        };

        private static readonly HttpClient QuoteHttpClient = new(QuoteHttpHandler)
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        private static readonly TimeSpan QuotePollInterval = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan QuoteStaleThreshold = TimeSpan.FromMinutes(2);
        private const string YahooQuoteUrl = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";

        private readonly YahooStreamRouter _router;
        private readonly ForexHandler _forexHandler;
        private readonly IMarketDataCache _marketDataCache;

        public YahooGlobalStreamService(
            IYahooPricingDecoder decoder,
            IOptions<MarketDataSettings> settings,
            YahooStreamRouter router,
            IMarketDataCache marketDataCache,
            ForexHandler forexHandler,
            ILogger<YahooGlobalStreamService> logger)
            : base(decoder, settings, logger)
        {
            _router = router;
            _marketDataCache = marketDataCache;
            _forexHandler = forexHandler;
        }

        protected override string ServiceName => nameof(YahooGlobalStreamService);

        protected override IReadOnlyCollection<string> GetSubscribeSymbols()
        {
            var symbols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var ticker in Settings.ForexTickers)
            {
                if (!string.IsNullOrWhiteSpace(ticker))
                {
                    symbols.Add(ticker.Trim());
                }
            }

            return symbols.ToArray();
        }

        protected override Task<bool> CanConnectAsync(CancellationToken cancellationToken) =>
            Task.FromResult(true);

        // Global stream should stay connected without session-driven inactivity timeout.
        protected override int? GetReceiveTimeoutSeconds() => null;

        protected override async Task OnRuntimeSubscribeAsync(System.Net.WebSockets.ClientWebSocket socket, CancellationToken cancellationToken)
        {
            // Seed once immediately and then keep refreshing if stream is missing/stale.
            await TryRefreshFromYahooQuoteApiAsync(cancellationToken);

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(QuotePollInterval, cancellationToken);
                    await TryRefreshFromYahooQuoteApiAsync(cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        protected override Task HandlePricingDataAsync(PricingData data, CancellationToken cancellationToken)
        {
            if (data is null || string.IsNullOrWhiteSpace(data.Id))
            {
                Logger.LogDebug("{ServiceName}: received invalid pricing payload.", ServiceName);
                return Task.CompletedTask;
            }

            var route = _router.ResolveRoute(data.Id);
            if (route != YahooStreamRouteType.Forex)
            {
                Logger.LogDebug("{ServiceName}: ignored non-global ticker={Ticker} route={Route}.", ServiceName, data.Id, route);
                return Task.CompletedTask;
            }

            _forexHandler.HandleYahoo(data);

            Logger.LogDebug(
                "{ServiceName}: route={Route} ticker={Ticker} price={Price} change={Change} pct={ChangePercent}",
                ServiceName,
                route,
                data.Id,
                data.Price,
                data.Change,
                data.ChangePercent);

            return Task.CompletedTask;
        }

        private async Task TryRefreshFromYahooQuoteApiAsync(CancellationToken cancellationToken)
        {
            if (!ShouldPollQuoteApi())
            {
                return;
            }

            var symbols = GetSubscribeSymbols()
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (symbols.Length == 0)
            {
                return;
            }

            try
            {
                var url = YahooQuoteUrl + Uri.EscapeDataString(string.Join(",", symbols));
                using var response = await QuoteHttpClient.GetAsync(url, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    Logger.LogWarning(
                        "{ServiceName}: Yahoo quote fallback failed status={StatusCode}.",
                        ServiceName,
                        (int)response.StatusCode);
                    return;
                }

                using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

                if (!doc.RootElement.TryGetProperty("quoteResponse", out var quoteResponse) ||
                    !quoteResponse.TryGetProperty("result", out var result) ||
                    result.ValueKind != JsonValueKind.Array)
                {
                    return;
                }

                var applied = 0;
                foreach (var item in result.EnumerateArray())
                {
                    var symbol = GetString(item, "symbol");
                    if (string.IsNullOrWhiteSpace(symbol))
                    {
                        continue;
                    }

                    var price = GetDecimal(item, "regularMarketPrice");
                    if (price <= 0m)
                    {
                        continue;
                    }

                    var unixSeconds = GetLong(item, "regularMarketTime");
                    var data = new PricingData
                    {
                        Id = symbol,
                        Price = (float)price,
                        Time = unixSeconds > 0 ? unixSeconds * 1000 : 0,
                        Change = (float)GetDecimal(item, "regularMarketChange"),
                        ChangePercent = (float)GetDecimal(item, "regularMarketChangePercent")
                    };

                    var route = _router.ResolveRoute(symbol);
                    if (route != YahooStreamRouteType.Forex)
                    {
                        continue;
                    }

                    _forexHandler.HandleYahoo(data);
                    applied++;
                }

                if (applied > 0)
                {
                    Logger.LogInformation(
                        "{ServiceName}: Yahoo quote fallback applied updates for {Count} symbols.",
                        ServiceName,
                        applied);
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "{ServiceName}: Yahoo quote fallback error.", ServiceName);
            }
        }

        private bool ShouldPollQuoteApi()
        {
            var now = DateTime.UtcNow;

            var forex = _marketDataCache.GetForex("USDTRY");
            var forexFresh = forex is not null && now - forex.UpdatedAt <= QuoteStaleThreshold;

            // Poll quote API only when forex feed is missing or stale.
            return !forexFresh;
        }

        private static string? GetString(JsonElement obj, string name)
        {
            return obj.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }

        private static decimal GetDecimal(JsonElement obj, string name)
        {
            if (!obj.TryGetProperty(name, out var value))
            {
                return 0m;
            }

            return value.ValueKind switch
            {
                JsonValueKind.Number when value.TryGetDecimal(out var d) => d,
                JsonValueKind.Number => (decimal)value.GetDouble(),
                JsonValueKind.String when decimal.TryParse(value.GetString(), out var s) => s,
                _ => 0m
            };
        }

        private static long GetLong(JsonElement obj, string name)
        {
            if (!obj.TryGetProperty(name, out var value))
            {
                return 0L;
            }

            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var l))
            {
                return l;
            }

            if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out var sl))
            {
                return sl;
            }

            return 0L;
        }
    }
#nullable restore
}
