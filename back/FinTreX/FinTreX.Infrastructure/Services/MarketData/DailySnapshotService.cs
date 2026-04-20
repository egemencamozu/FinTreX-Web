using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Models.MarketData;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Services.MarketData.Session;
using FinTreX.Infrastructure.Services.MarketData.Symbols;
using Npgsql;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData
{
#nullable enable
    /// <summary>
    /// Periodically flushes the in-memory market data cache to the DailyCloses table
    /// every 5 minutes while the BIST session is active.
    /// Also writes a final snapshot on graceful shutdown to minimize data loss.
    /// On startup, warms the in-memory cache from the latest DB snapshot so users
    /// see data immediately after a restart instead of waiting for the next session.
    /// </summary>
    public sealed class DailySnapshotService : BackgroundService
    {
        private static readonly TimeSpan SnapshotInterval = TimeSpan.FromMinutes(5);

        private readonly IMarketDataCache _cache;
        private readonly BistSessionManager _sessionManager;
        private readonly IBistSymbolProvider _symbolProvider;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IOptionsMonitor<MarketDataSettings> _settingsMonitor;
        private readonly ILogger<DailySnapshotService> _logger;

        public DailySnapshotService(
            IMarketDataCache cache,
            BistSessionManager sessionManager,
            IBistSymbolProvider symbolProvider,
            IServiceScopeFactory scopeFactory,
            IOptionsMonitor<MarketDataSettings> settingsMonitor,
            ILogger<DailySnapshotService> logger)
        {
            _cache = cache;
            _sessionManager = sessionManager;
            _symbolProvider = symbolProvider;
            _scopeFactory = scopeFactory;
            _settingsMonitor = settingsMonitor;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("DailySnapshotService started. Interval={Interval}.", SnapshotInterval);

            await WarmUpFromDbAsync(stoppingToken);

            using var timer = new PeriodicTimer(SnapshotInterval);

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var state = _sessionManager.GetCurrentState();

                if (state == BistSessionState.Closed)
                {
                    // No active session — nothing meaningful to persist.
                    continue;
                }

                await TakeSnapshotAsync(stoppingToken);
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            // Final snapshot on graceful shutdown so at most 5 minutes of data is lost
            // instead of everything since the last periodic tick.
            _logger.LogInformation("DailySnapshotService stopping — writing final snapshot.");
            await TakeSnapshotAsync(cancellationToken);
            await base.StopAsync(cancellationToken);
        }

        private async Task WarmUpFromDbAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IDailyCloseRepository>();

                var stockTickers = _symbolProvider.GetSymbols();
                var indexTickers = _settingsMonitor.CurrentValue.BistIndexTickers;

                var stocks = await repo.GetLatestByTickersAsync(stockTickers, "STOCK", cancellationToken);
                var indices = await repo.GetLatestByTickersAsync(indexTickers, "INDEX", cancellationToken);

                foreach (var row in stocks)
                {
                    var symbolInfo = _symbolProvider.GetSymbolInfo(row.Ticker);
                    _cache.SetStock(row.Ticker, new StockPrice
                    {
                        Ticker = row.Ticker,
                        CompanyName = symbolInfo?.CompanyName ?? string.Empty,
                        Sector = symbolInfo?.Sector ?? string.Empty,
                        Price = row.ClosePrice,
                        Change = row.Change,
                        ChangePercent = row.ChangePercent,
                        Volume = row.Volume ?? 0L,
                        UpdatedAt = row.WrittenAt
                    });
                }

                foreach (var row in indices)
                {
                    _cache.SetIndex(row.Ticker, new IndexPrice
                    {
                        Ticker = row.Ticker,
                        Price = row.ClosePrice,
                        Change = row.Change,
                        ChangePercent = row.ChangePercent,
                        UpdatedAt = row.WrittenAt
                    });
                }

                _logger.LogInformation(
                    "DailySnapshotService warm-up complete: stocks={StockCount} indices={IndexCount}.",
                    stocks.Count, indices.Count);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" &&
                ex.Message.Contains("DailyCloses", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("DailySnapshotService warm-up skipped: DailyCloses table does not exist yet.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DailySnapshotService warm-up failed — cache will be empty until first Yahoo tick.");
            }
        }

        private async Task TakeSnapshotAsync(CancellationToken cancellationToken)
        {
            var today = _sessionManager.GetLocalDate();
            var writtenAt = DateTime.UtcNow;

            var stocks = _cache.GetAllStocks();
            var indices = _cache.GetAllIndices();

            if (stocks.Count == 0 && indices.Count == 0)
            {
                _logger.LogDebug("DailySnapshotService: cache is empty, skipping snapshot.");
                return;
            }

            var records = new List<DailyClose>(stocks.Count + indices.Count);

            foreach (var stock in stocks)
            {
                if (!stock.Ticker.EndsWith(".IS", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                records.Add(new DailyClose
                {
                    Ticker = stock.Ticker,
                    AssetType = "STOCK",
                    ClosePrice = stock.Price,
                    Change = stock.Change,
                    ChangePercent = stock.ChangePercent,
                    Volume = stock.Volume,
                    Date = today,
                    WrittenAt = writtenAt
                });
            }

            foreach (var index in indices)
            {
                records.Add(new DailyClose
                {
                    Ticker = index.Ticker,
                    AssetType = "INDEX",
                    ClosePrice = index.Price,
                    Change = index.Change,
                    ChangePercent = index.ChangePercent,
                    Volume = null,
                    Date = today,
                    WrittenAt = writtenAt
                });
            }

            if (records.Count == 0)
            {
                return;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IDailyCloseRepository>();
                await repo.UpsertBatchAsync(records, cancellationToken);

                _logger.LogInformation(
                    "DailySnapshotService: snapshot written. stocks={StockCount} indices={IndexCount} date={Date}",
                    stocks.Count, indices.Count, today);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" &&
                ex.Message.Contains("DailyCloses", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("DailySnapshotService: DailyCloses table missing, snapshot skipped.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DailySnapshotService: snapshot failed.");
            }
        }
    }
#nullable restore
}
