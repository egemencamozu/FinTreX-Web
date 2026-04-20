using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Contexts;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Decode;
using FinTreX.Infrastructure.Services.MarketData.Handlers;
using FinTreX.Infrastructure.Services.MarketData.Routing;
using FinTreX.Infrastructure.Services.MarketData.Session;
using FinTreX.Infrastructure.Services.MarketData.Symbols;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.WebSocket
{
#nullable enable
    /// <summary>
    /// Session-aware Yahoo stream for BIST instruments.
    /// Connects during active sessions and lunch break, sleeps while market is closed.
    /// </summary>
    public sealed class YahooBistStreamService : YahooWebSocketBase, IBistSubscriptionManager
    {
        private readonly YahooStreamRouter _router;
        private readonly BistSessionManager _sessionManager;
        private readonly IBistSymbolProvider _bistSymbolProvider;
        private readonly BistStockHandler _bistStockHandler;
        private readonly BistIndexHandler _bistIndexHandler;
        private readonly IServiceScopeFactory _scopeFactory;

        // Runtime dynamic subscriptions: symbols requested while stream is live.
        private readonly Channel<string> _pendingSubscriptions =
            Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
        private readonly HashSet<string> _subscribedSymbols = new(StringComparer.OrdinalIgnoreCase);

        public YahooBistStreamService(
            IYahooPricingDecoder decoder,
            IOptions<MarketDataSettings> settings,
            YahooStreamRouter router,
            BistSessionManager sessionManager,
            IBistSymbolProvider bistSymbolProvider,
            BistStockHandler bistStockHandler,
            BistIndexHandler bistIndexHandler,
            IServiceScopeFactory scopeFactory,
            ILogger<YahooBistStreamService> logger)
            : base(decoder, settings, logger)
        {
            _router = router;
            _sessionManager = sessionManager;
            _bistSymbolProvider = bistSymbolProvider;
            _bistStockHandler = bistStockHandler;
            _bistIndexHandler = bistIndexHandler;
            _scopeFactory = scopeFactory;
        }

        protected override string ServiceName => nameof(YahooBistStreamService);

        protected override Task<bool> CanConnectAsync(CancellationToken cancellationToken)
        {
            var state = _sessionManager.GetCurrentState();
            return Task.FromResult(state != BistSessionState.Closed);
        }

        protected override Task OnIdleAsync(CancellationToken cancellationToken)
        {
            var state = _sessionManager.GetCurrentState();
            if (state != BistSessionState.Closed)
            {
                return Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
            }

            var wait = _sessionManager.GetTimeUntilNextSession();
            if (wait <= TimeSpan.Zero)
            {
                return Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
            }

            Logger.LogInformation("{ServiceName}: market closed, sleeping for {Delay}.", ServiceName, wait);
            return Task.Delay(wait, cancellationToken);
        }

        protected override int? GetReceiveTimeoutSeconds()
        {
            var timeoutSeconds = _sessionManager.GetTimeoutSeconds();

            if (timeoutSeconds == int.MaxValue)
            {
                // Lunch break: connection stays open and timeout is disabled.
                return null;
            }

            if (timeoutSeconds <= 0)
            {
                // If state changes to Closed while connected, force a quick loop break.
                return 1;
            }

            return timeoutSeconds;
        }

        /// <inheritdoc />
        public void RequestSubscription(string ticker)
        {
            if (string.IsNullOrWhiteSpace(ticker))
                return;

            var normalized = ticker.Trim().ToUpperInvariant();
            if (!normalized.EndsWith(".IS", StringComparison.Ordinal))
                normalized = $"{normalized}.IS";

            // Skip if already tracked (best-effort; _subscribedSymbols is updated on connect)
            if (_subscribedSymbols.Contains(normalized))
                return;

            _pendingSubscriptions.Writer.TryWrite(normalized);
        }

        protected override IReadOnlyCollection<string> GetSubscribeSymbols()
        {
            var symbols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            AddSymbols(symbols, _bistSymbolProvider.GetSymbols());
            AddSymbols(symbols, Settings.Bist30Tickers);
            AddSymbols(symbols, Settings.BistIndexTickers);
            AddSymbols(symbols, GetDynamicPortfolioSymbols());

            // Track what we subscribed so RequestSubscription can skip duplicates.
            _subscribedSymbols.Clear();
            foreach (var s in symbols)
                _subscribedSymbols.Add(s);

            Logger.LogInformation(
                "{ServiceName}: prepared {Count} BIST symbols for subscription.",
                ServiceName,
                symbols.Count);

            return symbols.ToArray();
        }

        protected override Task HandlePricingDataAsync(PricingData data, CancellationToken cancellationToken)
        {
            if (data is null || string.IsNullOrWhiteSpace(data.Id))
            {
                Logger.LogDebug("{ServiceName}: invalid pricing payload.", ServiceName);
                return Task.CompletedTask;
            }

            var route = _router.ResolveRoute(data.Id);
            if (route != YahooStreamRouteType.BistStock && route != YahooStreamRouteType.BistIndex)
            {
                // BIST service intentionally processes only BIST stock/index routes.
                return Task.CompletedTask;
            }

            if (route == YahooStreamRouteType.BistStock)
            {
                _bistStockHandler.HandleYahoo(data);
            }
            else if (route == YahooStreamRouteType.BistIndex)
            {
                _bistIndexHandler.HandleYahoo(data);
            }

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

        /// <summary>
        /// Runs concurrently with ReceiveLoopAsync. Drains the pending subscriptions
        /// channel and sends subscribe payloads over the active socket.
        /// Returns when the socket closes or the token is cancelled.
        /// </summary>
        protected override async Task OnRuntimeSubscribeAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var reader = _pendingSubscriptions.Reader;

            while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
            {
                string ticker;
                try
                {
                    ticker = await reader.ReadAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                if (_subscribedSymbols.Contains(ticker))
                    continue;

                try
                {
                    var payload = JsonSerializer.Serialize(new { subscribe = new[] { ticker } });
                    var bytes = Encoding.UTF8.GetBytes(payload);
                    await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);
                    _subscribedSymbols.Add(ticker);

                    Logger.LogInformation(
                        "{ServiceName}: dynamically subscribed to {Ticker}.",
                        ServiceName, ticker);
                }
                catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
                {
                    Logger.LogWarning(ex, "{ServiceName}: failed to send dynamic subscribe for {Ticker}.", ServiceName, ticker);
                }
            }
        }

        private static void AddSymbols(HashSet<string> destination, IEnumerable<string> symbols)
        {
            foreach (var symbol in symbols)
            {
                if (string.IsNullOrWhiteSpace(symbol))
                {
                    continue;
                }

                var normalized = symbol.Trim().ToUpperInvariant();
                if (!normalized.EndsWith(".IS", StringComparison.Ordinal))
                {
                    continue;
                }

                destination.Add(normalized);
            }
        }

        private IReadOnlyCollection<string> GetDynamicPortfolioSymbols()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var symbols = dbContext.PortfolioAssets
                    .AsNoTracking()
                    .Where(x => x.AssetType == AssetType.BIST && x.Symbol != null && x.Symbol != string.Empty)
                    .Select(x => x.Symbol)
                    .Distinct()
                    .ToList();

                if (symbols.Count == 0)
                {
                    return Array.Empty<string>();
                }

                var normalized = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var symbol in symbols)
                {
                    if (string.IsNullOrWhiteSpace(symbol))
                    {
                        continue;
                    }

                    var normalizedSymbol = symbol.Trim().ToUpperInvariant();
                    if (!normalizedSymbol.EndsWith(".IS", StringComparison.Ordinal))
                    {
                        normalizedSymbol = $"{normalizedSymbol}.IS";
                    }

                    normalized.Add(normalizedSymbol);
                }

                Logger.LogDebug(
                    "{ServiceName}: loaded {Count} dynamic portfolio symbols.",
                    ServiceName,
                    normalized.Count);

                return normalized.ToArray();
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "{ServiceName}: failed to load dynamic portfolio symbols.", ServiceName);
                return Array.Empty<string>();
            }
        }
    }
#nullable restore
}
