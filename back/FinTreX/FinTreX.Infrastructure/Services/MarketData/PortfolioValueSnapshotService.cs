using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FinTreX.Core.Settings;

namespace FinTreX.Infrastructure.Services.MarketData
{
    /// <summary>
    /// Persists immutable portfolio valuation points used by history charts.
    /// </summary>
    public sealed class PortfolioValueSnapshotService : BackgroundService
    {
        private const int MinSnapshotIntervalSeconds = 10;
        private const int MaxSnapshotIntervalSeconds = 3600;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMarketDataCache _marketDataCache;
        private readonly IOptionsMonitor<MarketDataSettings> _settingsMonitor;
        private readonly ILogger<PortfolioValueSnapshotService> _logger;

        public PortfolioValueSnapshotService(
            IServiceScopeFactory scopeFactory,
            IMarketDataCache marketDataCache,
            IOptionsMonitor<MarketDataSettings> settingsMonitor,
            ILogger<PortfolioValueSnapshotService> logger)
        {
            _scopeFactory = scopeFactory;
            _marketDataCache = marketDataCache;
            _settingsMonitor = settingsMonitor;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var snapshotInterval = ResolveSnapshotInterval(_settingsMonitor.CurrentValue.PortfolioSnapshotIntervalSeconds);

            _logger.LogInformation(
                "PortfolioValueSnapshotService started. Interval={Interval}. RawSeconds={RawSeconds}.",
                snapshotInterval,
                _settingsMonitor.CurrentValue.PortfolioSnapshotIntervalSeconds);

            using var timer = new PeriodicTimer(snapshotInterval);

            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    await TakeSnapshotAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Expected on graceful shutdown — not an error.
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("PortfolioValueSnapshotService stopping - writing final snapshot.");
            await TakeSnapshotAsync(cancellationToken);
            await base.StopAsync(cancellationToken);
        }

        private async Task TakeSnapshotAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var repository = scope.ServiceProvider.GetRequiredService<IPortfolioValueSnapshotRepository>();

                var portfolios = await dbContext.Portfolios
                    .AsNoTracking()
                    .Include(x => x.Assets)
                    .ToListAsync(cancellationToken);

                if (portfolios.Count == 0)
                {
                    return;
                }

                var capturedAtUtc = DateTime.UtcNow;
                var usdTry = ResolveUsdTryRate();
                var snapshots = new List<PortfolioValueSnapshot>(portfolios.Count);

                foreach (var portfolio in portfolios)
                {
                    var (totalTry, totalUsd) = CalculateTotals(portfolio.Assets, usdTry);

                    snapshots.Add(new PortfolioValueSnapshot
                    {
                        PortfolioId = portfolio.Id,
                        CapturedAtUtc = capturedAtUtc,
                        TotalValueTry = Math.Round(totalTry, 8),
                        TotalValueUsd = Math.Round(totalUsd, 8),
                        UsdTryRate = usdTry > 0m ? usdTry : null
                    });
                }

                await repository.AddBatchAsync(snapshots, cancellationToken);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" &&
                ex.Message.Contains("PortfolioValueSnapshots", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("PortfolioValueSnapshotService: PortfolioValueSnapshots table missing, snapshot skipped.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PortfolioValueSnapshotService: snapshot write failed.");
            }
        }

        private decimal ResolveUsdTryRate()
        {
            var forex = _marketDataCache.GetForex("USDTRY");
            if (forex is not null && forex.Rate > 0m)
            {
                return forex.Rate;
            }

            return _marketDataCache.GetUsdTry();
        }

        private (decimal totalTry, decimal totalUsd) CalculateTotals(IEnumerable<PortfolioAsset> assets, decimal usdTry)
        {
            decimal totalTry = 0m;
            decimal totalUsd = 0m;

            foreach (var asset in assets)
            {
                var unitPrice = ResolveUnitPrice(asset);
                var positionValue = asset.Quantity * unitPrice;

                totalTry += ConvertCurrency(positionValue, asset.Currency, "TRY", usdTry);
                totalUsd += ConvertCurrency(positionValue, asset.Currency, "USD", usdTry);
            }

            return (totalTry, totalUsd);
        }

        private decimal ResolveUnitPrice(PortfolioAsset asset)
        {
            switch (asset.AssetType)
            {
                case AssetType.Crypto:
                {
                    var symbol = asset.Symbol.ToUpperInvariant() + "USDT";
                    var crypto = _marketDataCache.GetCrypto(symbol);
                    if (crypto is not null)
                    {
                        var assetCurrency = NormalizeCurrency(asset.Currency);
                        if (assetCurrency == "TRY" && crypto.PriceTry > 0m)
                        {
                            return crypto.PriceTry;
                        }

                        if (crypto.PriceUsdt > 0m)
                        {
                            return crypto.PriceUsdt;
                        }
                    }

                    break;
                }
                case AssetType.BIST:
                {
                    var ticker = asset.Symbol.ToUpperInvariant();
                    if (!ticker.EndsWith(".IS", StringComparison.OrdinalIgnoreCase))
                    {
                        ticker += ".IS";
                    }

                    var stock = _marketDataCache.GetStock(ticker);
                    if (stock is not null && stock.Price > 0m)
                    {
                        return stock.Price;
                    }

                    break;
                }
                case AssetType.PreciousMetal:
                {
                    var gold = _marketDataCache.GetGold(asset.Symbol);
                    if (gold is not null)
                    {
                        var assetCurrency = NormalizeCurrency(asset.Currency);
                        if (assetCurrency == "TRY" && gold.GramTry > 0m)
                        {
                            return gold.GramTry;
                        }

                        if (gold.GramUsd > 0m)
                        {
                            return gold.GramUsd;
                        }
                    }

                    break;
                }
            }

            return asset.CurrentValue ?? asset.AverageCost;
        }

        private static decimal ConvertCurrency(decimal amount, string fromCurrency, string targetCurrency, decimal usdTry)
        {
            var normalizedFrom = NormalizeCurrency(fromCurrency);
            if (normalizedFrom == targetCurrency)
            {
                return amount;
            }

            if (usdTry <= 0m)
            {
                return amount;
            }

            if (normalizedFrom == "USD" && targetCurrency == "TRY")
            {
                return amount * usdTry;
            }

            if (normalizedFrom == "TRY" && targetCurrency == "USD")
            {
                return amount / usdTry;
            }

            return amount;
        }

        private static string NormalizeCurrency(string? currency)
        {
            if (string.IsNullOrWhiteSpace(currency))
            {
                return "TRY";
            }

            return currency.Trim().ToUpperInvariant();
        }

        private static TimeSpan ResolveSnapshotInterval(int rawSeconds)
        {
            var bounded = Math.Clamp(rawSeconds, MinSnapshotIntervalSeconds, MaxSnapshotIntervalSeconds);
            return TimeSpan.FromSeconds(bounded);
        }
    }
}