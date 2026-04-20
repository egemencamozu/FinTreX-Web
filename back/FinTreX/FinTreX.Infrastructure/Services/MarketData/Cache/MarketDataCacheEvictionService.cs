using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.Cache
{
    /// <summary>
    /// Periodically removes orphaned metadata entries whose cache value no longer exists.
    /// All other eviction (inactive TTL, trim) has been removed — stream data is never
    /// artificially evicted; sources (Binance/Yahoo/DB warm-up) own the lifecycle.
    /// </summary>
    public sealed class MarketDataCacheEvictionService : BackgroundService
    {
        private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan StaleMetadataTtl = TimeSpan.FromMinutes(30);

        private readonly MarketDataCache _cache;
        private readonly ILogger<MarketDataCacheEvictionService> _logger;

        public MarketDataCacheEvictionService(
            MarketDataCache cache,
            ILogger<MarketDataCacheEvictionService> logger)
        {
            _cache = cache;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    RunSweep();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Market data cache eviction sweep failed.");
                }

                try
                {
                    await Task.Delay(SweepInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        private void RunSweep()
        {
            var now = DateTime.UtcNow;
            var removed = _cache.SweepStaleMetadata(StaleMetadataTtl, now);

            if (removed > 0)
            {
                _logger.LogInformation(
                    "Market cache sweep completed: staleMetadata={StaleRemoved}.",
                    removed);
            }
            else
            {
                _logger.LogDebug("Market cache sweep completed with no removals.");
            }
        }
    }
}
