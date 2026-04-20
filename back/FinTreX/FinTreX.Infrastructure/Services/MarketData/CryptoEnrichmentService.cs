using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Settings;
using FinTreX.Core.Models.MarketData;
using FinTreX.Core.DTOs.MarketData;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData
{
#nullable enable
    /// <summary>
    /// Enriches crypto ticks with:
    /// - Binance-based market cap/supply/network enrichments from external providers
    /// - CoinCap-based market cap and supply fields (primary)
    /// - CoinGecko-based market cap/supply/network fields (fallback)
    /// </summary>
    public sealed class CryptoEnrichmentService : BackgroundService, ICryptoMarketEnrichmentProvider
    {
        private static readonly SocketsHttpHandler HttpHandler = new()
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
        };

        private static readonly HttpClient HttpClient = new(HttpHandler)
        {
            Timeout = TimeSpan.FromSeconds(20),
        };

        // DB enrichment snapshot is reused on startup while it is still fresh enough.
        private static readonly TimeSpan DbCacheTtl = TimeSpan.FromDays(30);
        private const int StartupMinimumEnrichedCount = 400;
        private const int CoinGeckoPageSweepMinTargets = 20;

        private readonly MarketDataSettings _settings;
        private readonly IMarketDataCache _marketDataCache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CryptoEnrichmentService> _logger;

        private readonly ConcurrentDictionary<string, CryptoMarketEnrichment> _enrichmentBySymbol =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, byte> _attemptedNoMatchBySymbol =
            new(StringComparer.OrdinalIgnoreCase);

        private Dictionary<string, string[]> _platformsByCoinId = new(StringComparer.OrdinalIgnoreCase);
        private Dictionary<string, string[]> _coinIdsByBaseAsset = new(StringComparer.OrdinalIgnoreCase);
        private DateTime _platformsUpdatedAtUtc = DateTime.MinValue;

        // CoinCap rate-limit backoff.
        private DateTime _coinCapRetryAfterUtc = DateTime.MinValue;
        private int _coinCapConsecutiveFailures = 0;

        // CoinGecko rate-limit backoff: tracks how long to skip CoinGecko after a 429.
        private DateTime _coinGeckoRetryAfterUtc = DateTime.MinValue;
        private int _coinGeckoConsecutiveFailures = 0;
        private int _coinGeckoNextPage = 1;

        private sealed record StartupLoadResult(bool LoadedFromDb, string[] RetryTargets);

        static CryptoEnrichmentService()
        {
            HttpClient.DefaultRequestHeaders.UserAgent.ParseAdd("FinTreX/1.0 (+market-data)");
        }

        public CryptoEnrichmentService(
            IOptions<MarketDataSettings> settings,
            IMarketDataCache marketDataCache,
            IMarketDataBroadcaster broadcaster,
            IServiceScopeFactory scopeFactory,
            ILogger<CryptoEnrichmentService> logger)
        {
            _settings = settings.Value;
            _marketDataCache = marketDataCache;
            _broadcaster = broadcaster;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public CryptoMarketEnrichment? GetBySymbol(string symbol)
        {
            var normalized = NormalizeUsdtSymbol(symbol);
            if (string.IsNullOrEmpty(normalized))
            {
                return null;
            }

            return _enrichmentBySymbol.TryGetValue(normalized, out var enrichment)
                ? enrichment
                : null;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = TimeSpan.FromSeconds(Math.Max(30, _settings.CryptoEnrichmentRefreshSeconds));
            var startupRetryInterval = TimeSpan.FromSeconds(Math.Clamp(_settings.CryptoEnrichmentStartupRetrySeconds, 60, 3600));
            _logger.LogInformation(
                "CryptoEnrichmentService started. Interval={Interval}, StartupRetry={StartupRetry}.",
                interval,
                startupRetryInterval);

            // Wait for Binance WebSocket to connect and populate the cache before first refresh.
            await WaitForCachePopulatedAsync(stoppingToken);

            // Try to load enrichment from DB first — skip API calls if data is fresh enough.
            var startupLoad = await TryLoadFromDbAsync(stoppingToken);

            var startupSucceeded = startupLoad.LoadedFromDb;
            if (startupLoad.RetryTargets.Length > 0)
            {
                startupSucceeded =
                    await RefreshWithRetryAsync(startupLoad.RetryTargets, stoppingToken, fullCoinGeckoSweep: true) ||
                    startupSucceeded;
            }

            if (!startupSucceeded)
            {
                startupSucceeded = await RefreshWithRetryAsync(null, stoppingToken, fullCoinGeckoSweep: true);
            }

            while (!startupSucceeded && !stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "CryptoEnrichmentService: startup enrichment did not produce market data. Retrying in {RetryInterval}.",
                    startupRetryInterval);

                try
                {
                    await Task.Delay(startupRetryInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }

                // Retry in lightweight mode until the first successful market snapshot is obtained.
                startupSucceeded = await RefreshWithRetryAsync(null, stoppingToken, fullCoinGeckoSweep: false);
            }

            _logger.LogInformation("CryptoEnrichmentService: startup enrichment succeeded. Switching to steady interval.");

            using var timer = new PeriodicTimer(interval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RefreshWithRetryAsync(null, stoppingToken, fullCoinGeckoSweep: true);
            }
        }

        private async Task<StartupLoadResult> TryLoadFromDbAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<ICryptoEnrichmentRepository>();

                var lastRefreshed = await repo.GetLastRefreshedAtUtcAsync(cancellationToken);
                if (lastRefreshed is null)
                {
                    _logger.LogInformation("CryptoEnrichmentService: no DB cache found, will fetch from APIs.");
                    return new StartupLoadResult(false, Array.Empty<string>());
                }

                var age = DateTime.UtcNow - lastRefreshed.Value;
                if (age > DbCacheTtl)
                {
                    _logger.LogInformation(
                        "CryptoEnrichmentService: DB cache is {Days} days old (TTL={Ttl} days), will refresh from APIs.",
                        (int)age.TotalDays, (int)DbCacheTtl.TotalDays);
                    return new StartupLoadResult(false, Array.Empty<string>());
                }

                var snapshots = await repo.GetAllAsync(cancellationToken);
                if (snapshots.Count == 0)
                {
                    return new StartupLoadResult(false, Array.Empty<string>());
                }

                var visibleSymbols = ResolveAllCachedSymbols();
                var snapshotsBySymbol = snapshots
                    .Where(snapshot => !string.IsNullOrWhiteSpace(snapshot.Symbol))
                    .GroupBy(snapshot => snapshot.Symbol, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        group => group.Key,
                        group => group
                            .OrderByDescending(snapshot => snapshot.LastAttemptedAtUtc ?? snapshot.RefreshedAtUtc)
                            .First(),
                        StringComparer.OrdinalIgnoreCase);

                var nowUtc = DateTime.UtcNow;
                foreach (var s in snapshots.Where(IsEnrichedSnapshot))
                {
                    _enrichmentBySymbol[s.Symbol] = new CryptoMarketEnrichment
                    {
                        MarketCapUsdt = s.MarketCapUsdt,
                        CirculatingSupply = s.CirculatingSupply,
                        TotalSupply = s.TotalSupply,
                        Network = s.Network,
                        UpdatedAtUtc = s.RefreshedAtUtc,
                    };
                }

                var priceBySymbol = ResolvePriceBySymbol();
                ApplyEnrichmentToCryptoCache(visibleSymbols, priceBySymbol, nowUtc);

                var retryTargets = ResolveStartupRetryTargets(visibleSymbols, snapshotsBySymbol);

                _logger.LogInformation(
                    "CryptoEnrichmentService: loaded {Count} enrichments from DB (age={Days} days). startupRetryTargets={RetryTargetCount}.",
                    _enrichmentBySymbol.Count,
                    (int)age.TotalDays,
                    retryTargets.Length);

                return new StartupLoadResult(_enrichmentBySymbol.Count > 0, retryTargets);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CryptoEnrichmentService: DB cache load failed, falling back to API.");
                return new StartupLoadResult(false, Array.Empty<string>());
            }
        }

        private static bool HasAnyEnrichmentValue(CryptoEnrichmentSnapshot s) =>
            s.MarketCapUsdt.HasValue || s.CirculatingSupply.HasValue ||
            s.TotalSupply.HasValue || !string.IsNullOrEmpty(s.Network);

        private static bool IsEnrichedSnapshot(CryptoEnrichmentSnapshot snapshot) =>
            snapshot.EnrichmentStatus == CryptoEnrichmentStatus.Enriched &&
            HasAnyEnrichmentValue(snapshot);

        private async Task SaveToDbAsync(
            IReadOnlyList<CryptoEnrichmentSnapshot> snapshots,
            CancellationToken cancellationToken)
        {
            try
            {
                if (snapshots.Count == 0) return;

                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<ICryptoEnrichmentRepository>();
                await repo.UpsertBatchAsync(snapshots, cancellationToken);

                _logger.LogInformation("CryptoEnrichmentService: saved {Count} enrichments to DB.", snapshots.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CryptoEnrichmentService: failed to save enrichment to DB.");
            }
        }

        private async Task SaveToDbAsync(CancellationToken cancellationToken)
        {
            try
            {
                var nowUtc = DateTime.UtcNow;
                var snapshots = _enrichmentBySymbol
                    .Select(kv => new CryptoEnrichmentSnapshot
                    {
                        Symbol = kv.Key,
                        MarketCapUsdt = kv.Value.MarketCapUsdt,
                        CirculatingSupply = kv.Value.CirculatingSupply,
                        TotalSupply = kv.Value.TotalSupply,
                        Network = kv.Value.Network,
                        RefreshedAtUtc = nowUtc,
                    })
                    .ToList();

                if (snapshots.Count == 0) return;

                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<ICryptoEnrichmentRepository>();
                await repo.UpsertBatchAsync(snapshots, cancellationToken);

                _logger.LogInformation("CryptoEnrichmentService: saved {Count} enrichments to DB.", snapshots.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CryptoEnrichmentService: failed to save enrichment to DB.");
            }
        }

        private async Task WaitForCachePopulatedAsync(CancellationToken stoppingToken)
        {
            const int pollIntervalMs = 2000;
            var lastRequired = -1;

            while (!stoppingToken.IsCancellationRequested)
            {
                var minSymbolsRequired = GetStartupSymbolRequirement(out var expectedFromBinance);

                if (minSymbolsRequired != lastRequired)
                {
                    _logger.LogInformation(
                        "CryptoEnrichmentService: waiting for cache to reach at least {Required} symbols before startup enrichment (binanceExpected={Expected}).",
                        minSymbolsRequired,
                        expectedFromBinance);
                    lastRequired = minSymbolsRequired;
                }

                var count = _marketDataCache.GetAllCryptoNoTouch().Count;
                if (count >= minSymbolsRequired)
                {
                    _logger.LogInformation("CryptoEnrichmentService: cache has {Count} symbols, starting enrichment.", count);
                    return;
                }

                _logger.LogDebug("CryptoEnrichmentService: waiting for cache to populate (current={Count}, required={Required}).", count, minSymbolsRequired);
                await Task.Delay(pollIntervalMs, stoppingToken);
            }
        }

        private int GetStartupSymbolRequirement(out int expectedFromBinance)
        {
            var maxSymbols = Math.Clamp(_settings.CryptoEnrichmentMaxSymbols, 1, 2000);
            expectedFromBinance = _marketDataCache.GetExpectedCryptoSymbolCount();

            return expectedFromBinance > 0
                ? Math.Clamp(Math.Min(expectedFromBinance, maxSymbols), 50, 2000)
                : Math.Clamp(Math.Min(maxSymbols, 400), 50, 400);
        }

        private async Task<bool> RefreshWithRetryAsync(
            IReadOnlyList<string>? overrideSymbols,
            CancellationToken cancellationToken,
            bool fullCoinGeckoSweep)
        {
            var targets = ResolveTargetSymbols(overrideSymbols);
            if (targets.Count == 0)
            {
                return false;
            }

            var anySucceeded = await RefreshAsync(cancellationToken, fullCoinGeckoSweep, targets);
            var retryTargets = ResolveUnenrichedTargets(targets);
            if (retryTargets.Length > 0)
            {
                _logger.LogInformation(
                    "CryptoEnrichmentService: retrying unresolved symbols once more. count={Count}.",
                    retryTargets.Length);

                anySucceeded =
                    await RefreshAsync(cancellationToken, fullCoinGeckoSweep, retryTargets) ||
                    anySucceeded;
            }

            return anySucceeded || targets.Any(symbol =>
                _enrichmentBySymbol.TryGetValue(symbol, out var enrichment) && HasAnyValue(enrichment));
        }

        private async Task<bool> RefreshAsync(
            CancellationToken cancellationToken,
            bool fullCoinGeckoSweep = false,
            IReadOnlyList<string>? overrideSymbols = null)
        {
            var isScopedRefresh = overrideSymbols is { Count: > 0 };
            var symbols = ResolveTargetSymbols(overrideSymbols);
            if (symbols.Count == 0)
            {
                return false;
            }
            var priceBySymbol = ResolvePriceBySymbol();

            var marketBySymbol = new Dictionary<string, CoinGeckoMarketSnapshot>(StringComparer.OrdinalIgnoreCase);
            var marketProvider = "none";
            var anyProviderAttempted = false;
            var providerHadFailures = false;

            if (DateTime.UtcNow < _coinCapRetryAfterUtc)
            {
                var waitSeconds = (int)(_coinCapRetryAfterUtc - DateTime.UtcNow).TotalSeconds;
                _logger.LogInformation("CryptoEnrichmentService: skipping CoinCap (retry in {WaitSeconds}s).", waitSeconds);
            }
            else
            {
                anyProviderAttempted = true;
                try
                {
                    marketBySymbol = await FetchCoinCapMarketsAsync(symbols, cancellationToken);
                    marketProvider = "coincap";
                    _coinCapConsecutiveFailures = 0;
                    _coinCapRetryAfterUtc = DateTime.MinValue;
                    _logger.LogInformation("CryptoEnrichmentService: CoinCap fetched. MatchedSymbols={Count}.", marketBySymbol.Count);
                }
                catch (Exception ex)
                {
                    providerHadFailures = true;
                    _coinCapConsecutiveFailures++;
                    var backoffSeconds = Math.Min(120 * (1 << (_coinCapConsecutiveFailures - 1)), 1800);
                    _coinCapRetryAfterUtc = DateTime.UtcNow.AddSeconds(backoffSeconds);
                    _logger.LogWarning(ex, "CryptoEnrichmentService: CoinCap fetch failed (attempt {Attempt}). Retry after {BackoffSeconds}s.", _coinCapConsecutiveFailures, backoffSeconds);
                }
            }

            // CoinGecko fallback path for symbols not covered by CoinCap
            // or covered with incomplete/zeroed market fields.
            var fallbackTargets = ResolveFallbackTargets(symbols, marketBySymbol);
            if (fallbackTargets.Length > 0)
            {
                if (DateTime.UtcNow < _coinGeckoRetryAfterUtc)
                {
                    var waitSeconds = (int)(_coinGeckoRetryAfterUtc - DateTime.UtcNow).TotalSeconds;
                    _logger.LogInformation("CryptoEnrichmentService: skipping CoinGecko (rate-limited, retry in {WaitSeconds}s).", waitSeconds);
                }
                else
                {
                    anyProviderAttempted = true;
                    var platformsOk = true;
                    try
                    {
                        await RefreshPlatformsIfNeededAsync(cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        platformsOk = false;
                        providerHadFailures = true;
                        _coinGeckoConsecutiveFailures++;
                        var backoffSeconds = Math.Min(120 * (1 << (_coinGeckoConsecutiveFailures - 1)), 1800);
                        _coinGeckoRetryAfterUtc = DateTime.UtcNow.AddSeconds(backoffSeconds);
                        _logger.LogWarning(ex, "CryptoEnrichmentService: CoinGecko platform fetch failed (attempt {Attempt}). Retry after {BackoffSeconds}s.", _coinGeckoConsecutiveFailures, backoffSeconds);
                    }

                    if (platformsOk)
                    {
                        try
                        {
                            Dictionary<string, CoinGeckoMarketSnapshot> fallbackBySymbol;
                            if (fullCoinGeckoSweep)
                            {
                                fallbackBySymbol = await FetchCoinGeckoWarmupSnapshotAsync(fallbackTargets, cancellationToken);
                                _logger.LogInformation("CryptoEnrichmentService: CoinGecko startup fallback completed. MatchedSymbols={Count}.", fallbackBySymbol.Count);
                            }
                            else
                            {
                                var pageToFetch = GetAndAdvanceCoinGeckoPage();
                                fallbackBySymbol = await FetchCoinGeckoMarketsAsync(fallbackTargets, pageToFetch, cancellationToken);
                                _logger.LogInformation("CryptoEnrichmentService: CoinGecko page {Page} fallback fetched. MatchedSymbols={Count}.", pageToFetch, fallbackBySymbol.Count);
                            }

                            MergeCoinGeckoSnapshots(marketBySymbol, fallbackBySymbol);
                            if (fallbackBySymbol.Count > 0)
                            {
                                marketProvider = AppendProvider(marketProvider, "coingecko");
                            }
                            _coinGeckoConsecutiveFailures = 0;
                            _coinGeckoRetryAfterUtc = DateTime.MinValue;
                        }
                        catch (Exception ex)
                        {
                            providerHadFailures = true;
                            _coinGeckoConsecutiveFailures++;
                            var backoffSeconds = Math.Min(120 * (1 << (_coinGeckoConsecutiveFailures - 1)), 1800);
                            _coinGeckoRetryAfterUtc = DateTime.UtcNow.AddSeconds(backoffSeconds);
                            _logger.LogWarning(ex, "CryptoEnrichmentService: CoinGecko market fetch failed (attempt {Attempt}). Retry after {BackoffSeconds}s.", _coinGeckoConsecutiveFailures, backoffSeconds);
                        }
                    }
                }
            }

            var marketDataAvailable = marketBySymbol.Count > 0;
            var nowUtc = DateTime.UtcNow;

            foreach (var symbol in symbols)
            {
                var hasMarketData = marketBySymbol.TryGetValue(symbol, out var marketSnapshot);
                _enrichmentBySymbol.TryGetValue(symbol, out var existing);
                var marketCapUsdt = hasMarketData ? (marketSnapshot.MarketCapUsdt ?? existing?.MarketCapUsdt) : existing?.MarketCapUsdt;
                var circulatingSupply = hasMarketData ? (marketSnapshot.CirculatingSupply ?? existing?.CirculatingSupply) : existing?.CirculatingSupply;

                if (!marketCapUsdt.HasValue &&
                    circulatingSupply.HasValue &&
                    priceBySymbol.TryGetValue(symbol, out var priceUsdt) &&
                    priceUsdt > 0m)
                {
                    marketCapUsdt = priceUsdt * circulatingSupply.Value;
                }

                var enrichment = new CryptoMarketEnrichment
                {
                    // Preserve previous values when an upstream provider returns partial data.
                    MarketCapUsdt = marketCapUsdt,
                    CirculatingSupply = circulatingSupply,
                    TotalSupply = hasMarketData ? (marketSnapshot.TotalSupply ?? existing?.TotalSupply) : existing?.TotalSupply,
                    Network = hasMarketData ? (ResolveNetwork(marketSnapshot) ?? existing?.Network) : existing?.Network,
                    UpdatedAtUtc = nowUtc,
                };

                if (!HasAnyValue(enrichment))
                {
                    continue;
                }

                _enrichmentBySymbol[symbol] = enrichment;
                _attemptedNoMatchBySymbol.TryRemove(symbol, out _);
            }

            // Only evict stale symbols after a full refresh of the visible universe.
            // Scoped retry passes (for example the unresolved startup subset) must not
            // wipe enrichments that were already loaded for the rest of the cache.
            if (marketDataAvailable && !isScopedRefresh)
            {
                var symbolSet = new HashSet<string>(symbols, StringComparer.OrdinalIgnoreCase);
                foreach (var existingKey in _enrichmentBySymbol.Keys)
                {
                    if (!symbolSet.Contains(existingKey))
                    {
                        _enrichmentBySymbol.TryRemove(existingKey, out _);
                    }
                }
            }

            ApplyEnrichmentToCryptoCache(symbols, priceBySymbol, nowUtc);

            LogCoverageMetrics(symbols, marketBySymbol.Count, marketProvider, fullCoinGeckoSweep);

            if (marketDataAvailable || anyProviderAttempted)
            {
                var snapshotsToPersist = BuildPersistenceSnapshots(
                    symbols,
                    nowUtc,
                    marketProvider,
                    anyProviderAttempted,
                    providerHadFailures);

                await SaveToDbAsync(snapshotsToPersist, cancellationToken);
            }

            return marketDataAvailable;
        }

        private IReadOnlyList<string> ResolveTargetSymbols(IReadOnlyList<string>? overrideSymbols)
        {
            if (overrideSymbols is null || overrideSymbols.Count == 0)
            {
                return ResolveAllCachedSymbols();
            }

            return overrideSymbols
                .Select(NormalizeUsdtSymbol)
                .Where(symbol => !string.IsNullOrEmpty(symbol))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private string[] ResolveUnenrichedTargets(IReadOnlyList<string> symbols) =>
            symbols
                .Where(symbol =>
                    !_attemptedNoMatchBySymbol.ContainsKey(symbol) &&
                    (!_enrichmentBySymbol.TryGetValue(symbol, out var enrichment) || !HasAnyValue(enrichment)))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

        private static string[] ResolveStartupRetryTargets(
            IReadOnlyList<string> visibleSymbols,
            IReadOnlyDictionary<string, CryptoEnrichmentSnapshot> snapshotsBySymbol)
        {
            var enrichedVisibleCount = visibleSymbols.Count(symbol =>
                snapshotsBySymbol.TryGetValue(symbol, out var snapshot) && IsEnrichedSnapshot(snapshot));

            if (enrichedVisibleCount >= StartupMinimumEnrichedCount)
            {
                return Array.Empty<string>();
            }

            return visibleSymbols
                .Where(symbol =>
                {
                    if (!snapshotsBySymbol.TryGetValue(symbol, out var snapshot))
                    {
                        return true;
                    }

                    if (IsEnrichedSnapshot(snapshot))
                    {
                        return false;
                    }

                    return true;
                })
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private IReadOnlyList<CryptoEnrichmentSnapshot> BuildPersistenceSnapshots(
            IReadOnlyList<string> symbols,
            DateTime nowUtc,
            string marketProvider,
            bool anyProviderAttempted,
            bool providerHadFailures)
        {
            var snapshots = new List<CryptoEnrichmentSnapshot>(symbols.Count);
            var lastProvider = string.Equals(marketProvider, "none", StringComparison.OrdinalIgnoreCase)
                ? null
                : marketProvider;
            var missingStatus = anyProviderAttempted && !providerHadFailures
                ? CryptoEnrichmentStatus.AttemptedNoMatch
                : CryptoEnrichmentStatus.PendingRetry;

            foreach (var symbol in symbols)
            {
                if (_enrichmentBySymbol.TryGetValue(symbol, out var enrichment) && HasAnyValue(enrichment))
                {
                    snapshots.Add(new CryptoEnrichmentSnapshot
                    {
                        Symbol = symbol,
                        MarketCapUsdt = enrichment.MarketCapUsdt,
                        CirculatingSupply = enrichment.CirculatingSupply,
                        TotalSupply = enrichment.TotalSupply,
                        Network = enrichment.Network,
                        EnrichmentStatus = CryptoEnrichmentStatus.Enriched,
                        LastAttemptedAtUtc = anyProviderAttempted ? nowUtc : enrichment.UpdatedAtUtc,
                        LastProvider = lastProvider,
                        RefreshedAtUtc = nowUtc,
                    });

                    continue;
                }

                if (missingStatus == CryptoEnrichmentStatus.AttemptedNoMatch)
                {
                    _attemptedNoMatchBySymbol[symbol] = 0;
                }

                snapshots.Add(new CryptoEnrichmentSnapshot
                {
                    Symbol = symbol,
                    EnrichmentStatus = missingStatus,
                    LastAttemptedAtUtc = anyProviderAttempted ? nowUtc : null,
                    LastProvider = lastProvider,
                    RefreshedAtUtc = nowUtc,
                });
            }

            return snapshots;
        }

        private IReadOnlyList<string> ResolveAllCachedSymbols()
        {
            var bySymbolPriority = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in _marketDataCache.GetAllCryptoNoTouch())
            {
                var normalized = NormalizeUsdtSymbol(item.Symbol);
                if (!string.IsNullOrEmpty(normalized))
                {
                    var priority = item.PriceUsdt * item.Volume24h;
                    if (!bySymbolPriority.TryGetValue(normalized, out var existingPriority) || priority > existingPriority)
                    {
                        bySymbolPriority[normalized] = priority;
                    }
                }
            }

            var maxSymbols = Math.Clamp(_settings.CryptoEnrichmentMaxSymbols, 1, 2000);
            return bySymbolPriority
                .OrderByDescending(x => x.Value)
                .Take(maxSymbols)
                .Select(x => x.Key)
                .ToArray();
        }

        private int GetAndAdvanceCoinGeckoPage()
        {
            var maxPages = Math.Clamp(_settings.CoinGeckoMarketsPages, 1, 50);
            if (_coinGeckoNextPage < 1 || _coinGeckoNextPage > maxPages)
            {
                _coinGeckoNextPage = 1;
            }

            var page = _coinGeckoNextPage;
            _coinGeckoNextPage = page >= maxPages ? 1 : page + 1;
            return page;
        }

        private async Task<Dictionary<string, CoinGeckoMarketSnapshot>> FetchCoinGeckoWarmupSnapshotAsync(
            IReadOnlyList<string> targetSymbols,
            CancellationToken cancellationToken)
        {
            var ids = ResolveWarmupCoinGeckoIds(targetSymbols);
            var maxPages = Math.Clamp(_settings.CoinGeckoMarketsPages, 1, 50);
            var merged = new Dictionary<string, CoinGeckoMarketSnapshot>(StringComparer.OrdinalIgnoreCase);
            var anySuccess = false;
            var rateLimited = false;

            if (ids.Count > 0)
            {
                const int idsChunkSize = 60;
                var idChunks = ids.Chunk(idsChunkSize).ToArray();
                for (var index = 0; index < idChunks.Length; index++)
                {
                    try
                    {
                        var byIds = await FetchCoinGeckoMarketsByIdsAsync(targetSymbols, idChunks[index], cancellationToken);
                        MergeCoinGeckoSnapshots(merged, byIds);
                        anySuccess = true;

                        _logger.LogInformation(
                            "CryptoEnrichmentService: CoinGecko startup ids chunk {Chunk}/{TotalChunks} fetched. RequestedIds={RequestedIds} MatchedSymbols={Count}.",
                            index + 1,
                            idChunks.Length,
                            idChunks[index].Length,
                            byIds.Count);
                    }
                    catch (HttpRequestException ex) when (IsCoinGeckoRateLimited(ex))
                    {
                        rateLimited = true;
                        _coinGeckoRetryAfterUtc = DateTime.UtcNow.AddMinutes(5);
                        _logger.LogWarning(
                            ex,
                            "CryptoEnrichmentService: CoinGecko startup ids chunk {Chunk}/{TotalChunks} rate-limited (429). Warmup paused; retry after 300s.",
                            index + 1,
                            idChunks.Length);
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(
                            ex,
                            "CryptoEnrichmentService: CoinGecko startup ids chunk {Chunk}/{TotalChunks} failed.",
                            index + 1,
                            idChunks.Length);
                    }

                    if (index + 1 < idChunks.Length)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
                    }
                }
            }

            if (rateLimited)
            {
                _coinGeckoNextPage = 1;
                return merged;
            }

            var unresolved = targetSymbols
                .Where(symbol => !merged.ContainsKey(symbol))
                .ToArray();

            if (unresolved.Length > 0 && targetSymbols.Count < CoinGeckoPageSweepMinTargets)
            {
                _logger.LogInformation(
                    "CryptoEnrichmentService: skipping CoinGecko warmup page sweep for small target set. Targets={TargetCount} Threshold={Threshold} Unresolved={UnresolvedCount}.",
                    targetSymbols.Count,
                    CoinGeckoPageSweepMinTargets,
                    unresolved.Length);
                _coinGeckoNextPage = 1;
                return merged;
            }

            if (unresolved.Length > 0)
            {
                for (var page = 1; page <= maxPages; page++)
                {
                    try
                    {
                        var pageData = await FetchCoinGeckoMarketsAsync(unresolved, page, cancellationToken);
                        MergeCoinGeckoSnapshots(merged, pageData);
                        anySuccess = true;

                        _logger.LogInformation(
                            "CryptoEnrichmentService: CoinGecko warmup page {Page}/{TotalPages} fetched. MatchedSymbols={Count} RemainingBeforePage={Remaining}.",
                            page,
                            maxPages,
                            pageData.Count,
                            unresolved.Length);
                    }
                    catch (HttpRequestException ex) when (IsCoinGeckoRateLimited(ex))
                    {
                        _coinGeckoRetryAfterUtc = DateTime.UtcNow.AddMinutes(5);
                        _logger.LogWarning(
                            ex,
                            "CryptoEnrichmentService: CoinGecko warmup page {Page}/{TotalPages} rate-limited (429). Warmup paused; retry after 300s.",
                            page,
                            maxPages);
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(
                            ex,
                            "CryptoEnrichmentService: CoinGecko warmup page {Page}/{TotalPages} failed.",
                            page,
                            maxPages);
                    }

                    if (page < maxPages)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
                    }
                }
            }

            if (!anySuccess)
            {
                throw new HttpRequestException("CoinGecko warmup sweep failed for all configured pages.");
            }

            // After a full sweep, start normal rotation from first page.
            _coinGeckoNextPage = 1;
            return merged;
        }

        private static bool IsCoinGeckoRateLimited(HttpRequestException ex) =>
            ex.Message.Contains("429", StringComparison.OrdinalIgnoreCase);

        private List<string> ResolveWarmupCoinGeckoIds(IReadOnlyList<string> targetSymbols)
        {
            var symbolByBaseAsset = BuildCanonicalSymbolMap(targetSymbols);
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var baseAsset in symbolByBaseAsset.Keys)
            {
                if (!_coinIdsByBaseAsset.TryGetValue(baseAsset, out var coinIds))
                {
                    continue;
                }

                foreach (var id in coinIds)
                {
                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        ids.Add(id);
                    }
                }
            }

            return ids.ToList();
        }

        private static void MergeCoinGeckoSnapshots(
            Dictionary<string, CoinGeckoMarketSnapshot> target,
            Dictionary<string, CoinGeckoMarketSnapshot> source)
        {
            foreach (var (symbol, snapshot) in source)
            {
                if (target.TryGetValue(symbol, out var existing) &&
                    (snapshot.MarketCapUsdt ?? 0m) <= (existing.MarketCapUsdt ?? 0m))
                {
                    continue;
                }

                target[symbol] = snapshot;
            }
        }


        private async Task RefreshPlatformsIfNeededAsync(CancellationToken cancellationToken)
        {
            var refreshHours = Math.Clamp(_settings.CryptoEnrichmentPlatformRefreshHours, 1, 168);
            var isFresh = _platformsByCoinId.Count > 0 &&
                          _coinIdsByBaseAsset.Count > 0 &&
                          DateTime.UtcNow - _platformsUpdatedAtUtc < TimeSpan.FromHours(refreshHours);

            if (isFresh)
            {
                return;
            }

            var coingeckoBaseUrl = NormalizeBaseUrl(_settings.CoinGeckoRestBaseUrl, "https://api.coingecko.com/api/v3");
            var url = $"{coingeckoBaseUrl}/coins/list?include_platform=true";

            using var platformResponse = await HttpClient.GetAsync(url, cancellationToken);
            if (!platformResponse.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Response status code does not indicate success: {(int)platformResponse.StatusCode} ({platformResponse.ReasonPhrase}).");
            }
            using var stream = await platformResponse.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            var next = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            var nextIdsByBaseAsset = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var coin in doc.RootElement.EnumerateArray())
            {
                var id = GetString(coin, "id");
                if (string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var platforms = Array.Empty<string>();
                if (coin.TryGetProperty("platforms", out var platformsElement) &&
                    platformsElement.ValueKind == JsonValueKind.Object)
                {
                    platforms = platformsElement
                        .EnumerateObject()
                        .Where(prop => prop.Value.ValueKind == JsonValueKind.String)
                        .Select(prop => (Platform: prop.Name, Contract: prop.Value.GetString()))
                        .Where(pair => !string.IsNullOrWhiteSpace(pair.Contract))
                        .Select(pair => pair.Platform)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();
                }

                next[id] = platforms;

                var symbol = GetString(coin, "symbol").ToUpperInvariant();
                if (string.IsNullOrWhiteSpace(symbol))
                {
                    continue;
                }

                if (!nextIdsByBaseAsset.TryGetValue(symbol, out var idSet))
                {
                    idSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    nextIdsByBaseAsset[symbol] = idSet;
                }

                idSet.Add(id);
            }

            _platformsByCoinId = next;
            _coinIdsByBaseAsset = nextIdsByBaseAsset.ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value.ToArray(),
                StringComparer.OrdinalIgnoreCase);
            _platformsUpdatedAtUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "CryptoEnrichmentService: refreshed CoinGecko maps. Platforms={PlatformCount} BaseAssets={BaseAssetCount}.",
                next.Count,
                _coinIdsByBaseAsset.Count);
        }

        private async Task<Dictionary<string, CoinGeckoMarketSnapshot>> FetchCoinGeckoMarketsAsync(
            IReadOnlyList<string> targetSymbols,
            int page,
            CancellationToken cancellationToken)
        {
            var symbolByBaseAsset = BuildCanonicalSymbolMap(targetSymbols);
            var result = new Dictionary<string, CoinGeckoMarketSnapshot>(StringComparer.OrdinalIgnoreCase);

            var coingeckoBaseUrl = NormalizeBaseUrl(_settings.CoinGeckoRestBaseUrl, "https://api.coingecko.com/api/v3");
            var perPage = Math.Clamp(_settings.CoinGeckoMarketsPerPage, 1, 250);
            var safePage = Math.Max(1, page);
            var url = $"{coingeckoBaseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page={perPage}&page={safePage}&sparkline=false";

            using var marketsResponse = await HttpClient.GetAsync(url, cancellationToken);
            if (!marketsResponse.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Response status code does not indicate success: {(int)marketsResponse.StatusCode} ({marketsResponse.ReasonPhrase}).");
            }
            using var stream = await marketsResponse.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            CollectCoinGeckoSnapshotsFromMarketsJson(doc.RootElement, symbolByBaseAsset, result);

            return result;
        }

        private async Task<Dictionary<string, CoinGeckoMarketSnapshot>> FetchCoinCapMarketsAsync(
            IReadOnlyList<string> targetSymbols,
            CancellationToken cancellationToken)
        {
            var symbolByBaseAsset = BuildCanonicalSymbolMap(targetSymbols);
            var result = new Dictionary<string, CoinGeckoMarketSnapshot>(StringComparer.OrdinalIgnoreCase);
            if (symbolByBaseAsset.Count == 0)
            {
                return result;
            }

            var coinCapBaseUrl = NormalizeBaseUrl(_settings.CoinCapRestBaseUrl, "https://api.coincap.io/v2");
            var url = $"{coinCapBaseUrl}/assets?limit=2000";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(_settings.CoinCapApiKey))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.CoinCapApiKey);
            }

            using var response = await HttpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Response status code does not indicate success: {(int)response.StatusCode} ({response.ReasonPhrase}).");
            }

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (!doc.RootElement.TryGetProperty("data", out var dataElement) || dataElement.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            foreach (var item in dataElement.EnumerateArray())
            {
                var baseAsset = GetString(item, "symbol").ToUpperInvariant();
                if (string.IsNullOrWhiteSpace(baseAsset))
                {
                    continue;
                }

                if (!symbolByBaseAsset.TryGetValue(baseAsset, out var canonicalSymbol))
                {
                    continue;
                }

                var marketCap = NormalizePositiveOrNull(GetNullableDecimal(item, "marketCapUsd"));
                var circulatingSupply = NormalizePositiveOrNull(GetNullableDecimal(item, "supply"));
                var totalSupply = NormalizePositiveOrNull(GetNullableDecimal(item, "maxSupply"));

                var snapshot = new CoinGeckoMarketSnapshot(
                    CoinGeckoId: string.Empty,
                    Name: GetString(item, "name"),
                    MarketCapUsdt: marketCap,
                    CirculatingSupply: circulatingSupply,
                    TotalSupply: totalSupply);

                if (result.TryGetValue(canonicalSymbol, out var existing) &&
                    (snapshot.MarketCapUsdt ?? 0m) <= (existing.MarketCapUsdt ?? 0m))
                {
                    continue;
                }

                result[canonicalSymbol] = snapshot;
            }

            return result;
        }

        private async Task<Dictionary<string, CoinGeckoMarketSnapshot>> FetchCoinGeckoMarketsByIdsAsync(
            IReadOnlyList<string> targetSymbols,
            IReadOnlyList<string> coinGeckoIds,
            CancellationToken cancellationToken)
        {
            var symbolByBaseAsset = BuildCanonicalSymbolMap(targetSymbols);
            var result = new Dictionary<string, CoinGeckoMarketSnapshot>(StringComparer.OrdinalIgnoreCase);
            if (coinGeckoIds.Count == 0 || symbolByBaseAsset.Count == 0)
            {
                return result;
            }

            var coingeckoBaseUrl = NormalizeBaseUrl(_settings.CoinGeckoRestBaseUrl, "https://api.coingecko.com/api/v3");
            var escapedIds = coinGeckoIds.Select(Uri.EscapeDataString);
            var idsQuery = string.Join(",", escapedIds);
            var url = $"{coingeckoBaseUrl}/coins/markets?vs_currency=usd&ids={idsQuery}&sparkline=false";

            using var response = await HttpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Response status code does not indicate success: {(int)response.StatusCode} ({response.ReasonPhrase}).");
            }
            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            CollectCoinGeckoSnapshotsFromMarketsJson(doc.RootElement, symbolByBaseAsset, result);
            return result;
        }

        private static void CollectCoinGeckoSnapshotsFromMarketsJson(
            JsonElement marketsArray,
            Dictionary<string, string> symbolByBaseAsset,
            Dictionary<string, CoinGeckoMarketSnapshot> result)
        {
            foreach (var item in marketsArray.EnumerateArray())
            {
                var baseAsset = GetString(item, "symbol").ToUpperInvariant();
                if (string.IsNullOrWhiteSpace(baseAsset))
                {
                    continue;
                }

                if (!symbolByBaseAsset.TryGetValue(baseAsset, out var canonicalSymbol))
                {
                    continue;
                }

                var snapshot = new CoinGeckoMarketSnapshot(
                    CoinGeckoId: GetString(item, "id"),
                    Name: GetString(item, "name"),
                    MarketCapUsdt: GetNullableDecimal(item, "market_cap"),
                    CirculatingSupply: GetNullableDecimal(item, "circulating_supply"),
                    TotalSupply: GetNullableDecimal(item, "total_supply"));

                if (result.TryGetValue(canonicalSymbol, out var existing) &&
                    (snapshot.MarketCapUsdt ?? 0m) <= (existing.MarketCapUsdt ?? 0m))
                {
                    continue;
                }

                result[canonicalSymbol] = snapshot;
            }
        }

        private static bool NeedsMarketFallback(CoinGeckoMarketSnapshot snapshot) =>
            !snapshot.MarketCapUsdt.HasValue || snapshot.MarketCapUsdt.Value <= 0m ||
            !snapshot.CirculatingSupply.HasValue || snapshot.CirculatingSupply.Value <= 0m;

        private static string[] ResolveFallbackTargets(
            IReadOnlyList<string> symbols,
            Dictionary<string, CoinGeckoMarketSnapshot> marketBySymbol) =>
            symbols
                .Where(symbol => !marketBySymbol.TryGetValue(symbol, out var snapshot) || NeedsMarketFallback(snapshot))
                .ToArray();

        private static string AppendProvider(string provider, string providerToAdd)
        {
            if (string.IsNullOrWhiteSpace(provider) || provider.Equals("none", StringComparison.OrdinalIgnoreCase))
            {
                return providerToAdd;
            }

            return provider
                .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(part => part.Equals(providerToAdd, StringComparison.OrdinalIgnoreCase))
                ? provider
                : $"{provider}+{providerToAdd}";
        }

        private static decimal? NormalizePositiveOrNull(decimal? value) =>
            value.HasValue && value.Value > 0m ? value : null;

        private string? ResolveNetwork(CoinGeckoMarketSnapshot snapshot)
        {
            if (string.IsNullOrWhiteSpace(snapshot.CoinGeckoId))
            {
                return null;
            }

            if (!_platformsByCoinId.TryGetValue(snapshot.CoinGeckoId, out var platforms))
            {
                return null;
            }

            if (platforms.Length == 0)
            {
                return string.IsNullOrWhiteSpace(snapshot.Name) ? null : snapshot.Name;
            }

            if (platforms.Length > 1)
            {
                return "Multi-chain";
            }

            return NormalizePlatformName(platforms[0]);
        }

        private static string NormalizeBaseUrl(string? configuredUrl, string fallback)
        {
            var value = string.IsNullOrWhiteSpace(configuredUrl) ? fallback : configuredUrl.Trim();
            return value.TrimEnd('/');
        }

        private static bool HasAnyValue(CryptoMarketEnrichment enrichment) =>
            enrichment.MarketCapUsdt.HasValue ||
            enrichment.CirculatingSupply.HasValue ||
            enrichment.TotalSupply.HasValue ||
            !string.IsNullOrWhiteSpace(enrichment.Network);

        private static string NormalizeUsdtSymbol(string rawValue)
        {
            var normalized = (rawValue ?? string.Empty).Trim().ToUpperInvariant();
            return normalized.EndsWith("USDT", StringComparison.Ordinal) ? normalized : string.Empty;
        }

        private static Dictionary<string, string> BuildCanonicalSymbolMap(IReadOnlyList<string> usdtSymbols)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var symbol in usdtSymbols)
            {
                var normalized = NormalizeUsdtSymbol(symbol);
                if (string.IsNullOrEmpty(normalized) || normalized.Length <= 4)
                {
                    continue;
                }

                var baseAsset = normalized[..^4];
                if (!map.ContainsKey(baseAsset))
                {
                    map[baseAsset] = normalized;
                }
            }

            return map;
        }

        private Dictionary<string, decimal> ResolvePriceBySymbol()
        {
            var pricesBySymbol = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in _marketDataCache.GetAllCryptoNoTouch())
            {
                var normalized = NormalizeUsdtSymbol(item.Symbol);
                if (string.IsNullOrEmpty(normalized))
                {
                    continue;
                }

                if (!pricesBySymbol.TryGetValue(normalized, out var existingPrice) || item.PriceUsdt > existingPrice)
                {
                    pricesBySymbol[normalized] = item.PriceUsdt;
                }
            }

            return pricesBySymbol;
        }

        private void ApplyEnrichmentToCryptoCache(
            IReadOnlyList<string> symbols,
            IReadOnlyDictionary<string, decimal> priceBySymbol,
            DateTime nowUtc)
        {
            var symbolSet = new HashSet<string>(symbols, StringComparer.OrdinalIgnoreCase);
            var updatedCount = 0;

            foreach (var crypto in _marketDataCache.GetAllCryptoNoTouch())
            {
                var normalizedSymbol = NormalizeUsdtSymbol(crypto.Symbol);
                if (string.IsNullOrEmpty(normalizedSymbol) || !symbolSet.Contains(normalizedSymbol))
                {
                    continue;
                }

                if (!_enrichmentBySymbol.TryGetValue(normalizedSymbol, out var enrichment))
                {
                    continue;
                }

                var marketCapUsdt = enrichment.MarketCapUsdt;
                if (!marketCapUsdt.HasValue &&
                    enrichment.CirculatingSupply.HasValue &&
                    priceBySymbol.TryGetValue(normalizedSymbol, out var priceUsdt) &&
                    priceUsdt > 0m)
                {
                    marketCapUsdt = priceUsdt * enrichment.CirculatingSupply.Value;
                }

                var hasChanges =
                    crypto.MarketCapUsdt != marketCapUsdt ||
                    crypto.CirculatingSupply != enrichment.CirculatingSupply ||
                    crypto.TotalSupply != enrichment.TotalSupply ||
                    !string.Equals(crypto.Network, enrichment.Network, StringComparison.Ordinal);

                if (!hasChanges)
                {
                    continue;
                }

                var updated = CloneWithEnrichment(crypto, enrichment, marketCapUsdt, nowUtc);

                _marketDataCache.SetCrypto(normalizedSymbol, updated);
                _broadcaster.BroadcastCryptoUpdate(ToDto(updated))
                    .SafeFireAndForget(_logger, "BroadcastCryptoUpdate");
                updatedCount++;
            }

            if (updatedCount > 0)
            {
                _logger.LogInformation(
                    "CryptoEnrichmentService: applied enrichment to crypto cache for {UpdatedCount} symbols.",
                    updatedCount);
            }
        }

        private static CryptoPriceDto ToDto(CryptoCurrency model) =>
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

        private static CryptoCurrency CloneWithEnrichment(
            CryptoCurrency source,
            CryptoMarketEnrichment enrichment,
            decimal? marketCapUsdt,
            DateTime updatedAtUtc) =>
            new()
            {
                Symbol = source.Symbol,
                BaseAsset = source.BaseAsset,
                PriceUsdt = source.PriceUsdt,
                PriceTry = source.PriceTry,
                Change24h = source.Change24h,
                ChangePercent1h = source.ChangePercent1h,
                ChangePercent4h = source.ChangePercent4h,
                ChangePercent24h = source.ChangePercent24h,
                MarketCapUsdt = marketCapUsdt,
                CirculatingSupply = enrichment.CirculatingSupply,
                TotalSupply = enrichment.TotalSupply,
                Network = enrichment.Network,
                Volume24h = source.Volume24h,
                High24h = source.High24h,
                Low24h = source.Low24h,
                TrySource = source.TrySource,
                UpdatedAt = updatedAtUtc
            };

        private void LogCoverageMetrics(
            IReadOnlyList<string> symbols,
            int marketMatchedSymbols,
            string marketProvider,
            bool startupWarmup)
        {
            var marketCapCount = 0;
            var circulatingCount = 0;
            var totalSupplyCount = 0;
            var networkCount = 0;
            var anyCount = 0;

            foreach (var symbol in symbols)
            {
                if (!_enrichmentBySymbol.TryGetValue(symbol, out var enrichment))
                {
                    continue;
                }

                if (enrichment.MarketCapUsdt.GetValueOrDefault() > 0m) marketCapCount++;
                if (enrichment.CirculatingSupply.GetValueOrDefault() > 0m) circulatingCount++;
                if (enrichment.TotalSupply.GetValueOrDefault() > 0m) totalSupplyCount++;
                if (!string.IsNullOrWhiteSpace(enrichment.Network)) networkCount++;
                if (HasAnyValue(enrichment)) anyCount++;
            }

            _logger.LogInformation(
                "CryptoEnrichmentService: coverage [{Mode}] provider={Provider} total={Total} any={Any} matched={Matched} marketCap={MarketCap} circulating={Circulating} totalSupply={TotalSupply} network={Network}.",
                startupWarmup ? "startup" : "refresh",
                marketProvider,
                symbols.Count,
                anyCount,
                marketMatchedSymbols,
                marketCapCount,
                circulatingCount,
                totalSupplyCount,
                networkCount);
        }

        private static string GetString(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.String)
            {
                return string.Empty;
            }

            return value.GetString() ?? string.Empty;
        }

        private static decimal? GetNullableDecimal(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value))
            {
                return null;
            }

            if (value.ValueKind == JsonValueKind.Null)
            {
                return null;
            }

            if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var numeric))
            {
                return numeric;
            }

            if (value.ValueKind == JsonValueKind.String &&
                decimal.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }

            return null;
        }

        private static string NormalizePlatformName(string rawName)
        {
            if (string.IsNullOrWhiteSpace(rawName))
            {
                return "Unknown";
            }

            var normalized = rawName.Trim().ToLowerInvariant();
            return normalized switch
            {
                "ethereum" => "Ethereum",
                "solana" => "Solana",
                "polygon-pos" => "Polygon",
                "binance-smart-chain" => "BNB Chain",
                "avalanche" => "Avalanche",
                "arbitrum-one" => "Arbitrum",
                "optimistic-ethereum" => "Optimism",
                "tron" => "TRON",
                "base" => "Base",
                "aptos" => "Aptos",
                "sui" => "Sui",
                _ => ToTitleCase(rawName),
            };
        }

        private static string ToTitleCase(string value)
        {
            var pieces = value
                .Split(new[] { '-', '_', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(part =>
                {
                    if (part.Length == 0)
                    {
                        return part;
                    }

                    if (part.Length == 1)
                    {
                        return part.ToUpperInvariant();
                    }

                    return char.ToUpperInvariant(part[0]) + part[1..].ToLowerInvariant();
                });

            var joined = string.Join(' ', pieces);
            return string.IsNullOrWhiteSpace(joined) ? value : joined;
        }

        private readonly record struct CoinGeckoMarketSnapshot(
            string CoinGeckoId,
            string Name,
            decimal? MarketCapUsdt,
            decimal? CirculatingSupply,
            decimal? TotalSupply);
    }
#nullable restore
}
