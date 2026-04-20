using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
#nullable enable
    /// <summary>
    /// Handles USDTRY feed updates.
    /// Current policy: Binance is the primary source.
    /// </summary>
    public sealed class ForexHandler
    {
        private const string Pair = "USDTRY";
        private const string YahooSource = "YAHOO";
        private const string BinanceSource = "BINANCE";
        private static readonly TimeSpan DependentRecalcMinInterval = TimeSpan.FromSeconds(2);

        private readonly IMarketDataCache _cache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly IOptionsMonitor<MarketDataSettings> _settingsMonitor;
        private readonly GoldHandler _goldHandler;
        private readonly CryptoHandler _cryptoHandler;
        private readonly ILogger<ForexHandler> _logger;
        private readonly object _stateLock = new();
        private readonly object _recalcLock = new();

        private DateTime? _lastYahooUpdatedAtUtc;
        private decimal? _lastYahooRate;
        private readonly DateTime _startedAtUtc = DateTime.UtcNow;
        private DateTime _lastDependentRecalcAtUtc = DateTime.MinValue;
        private bool _binanceFallbackLoggedOnce;

        public ForexHandler(
            IMarketDataCache cache,
            IMarketDataBroadcaster broadcaster,
            IOptionsMonitor<MarketDataSettings> settingsMonitor,
            GoldHandler goldHandler,
            CryptoHandler cryptoHandler,
            ILogger<ForexHandler> logger)
        {
            _cache = cache;
            _broadcaster = broadcaster;
            _settingsMonitor = settingsMonitor;
            _goldHandler = goldHandler;
            _cryptoHandler = cryptoHandler;
            _logger = logger;
        }

        public void HandleYahoo(PricingData data)
        {
            if (!TryReadPositiveRate(data.Price, out var rate))
            {
                _logger.LogWarning("ForexHandler ignored Yahoo payload with non-positive price. ticker={Ticker} price={Price}", data.Id, data.Price);
                return;
            }

            var nowUtc = DateTime.UtcNow;
            var observedAtUtc = GetObservedAtUtc(data.Time, nowUtc);
            var previous = _cache.GetForex(Pair);

            lock (_stateLock)
            {
                _lastYahooRate = rate;
                _lastYahooUpdatedAtUtc = observedAtUtc;
            }

            _cache.SetForex(Pair, new ForexRate
            {
                Pair = Pair,
                Rate = rate,
                Source = YahooSource,
                Quality = ForexQuality.Primary,
                UpdatedAt = observedAtUtc
            });

            _broadcaster.BroadcastForexUpdate(new ForexRateDto
            {
                Pair = Pair,
                Rate = rate,
                Source = YahooSource,
                Quality = "PRIMARY",
                UpdatedAt = observedAtUtc
            }).SafeFireAndForget(_logger, "BroadcastForexUpdate");

            RecalculateDependentTryPrices();

            if (previous?.Quality == ForexQuality.Approximate)
            {
                _logger.LogInformation(
                    "ForexHandler switched to PRIMARY source. pair={Pair} rate={Rate}",
                    Pair,
                    rate);
            }
        }

        /// <summary>
        /// Applies Binance USDTTRY update as the primary forex source.
        /// </summary>
        public bool TryHandleBinanceFallback(decimal usdtTryRate, DateTime? observedAtUtc = null)
        {
            if (usdtTryRate <= 0m)
            {
                _logger.LogWarning("ForexHandler ignored Binance update with non-positive rate. rate={Rate}", usdtTryRate);
                return false;
            }

            var nowUtc = observedAtUtc ?? DateTime.UtcNow;

            _cache.SetForex(Pair, new ForexRate
            {
                Pair = Pair,
                Rate = usdtTryRate,
                Source = BinanceSource,
                Quality = ForexQuality.Primary,
                UpdatedAt = nowUtc
            });

            _broadcaster.BroadcastForexUpdate(new ForexRateDto
            {
                Pair = Pair,
                Rate = usdtTryRate,
                Source = BinanceSource,
                Quality = "PRIMARY",
                UpdatedAt = nowUtc
            }).SafeFireAndForget(_logger, "BroadcastForexUpdate");

            RecalculateDependentTryPrices();

            return true;
        }

        private static bool TryReadPositiveRate(float rawPrice, out decimal rate)
        {
            rate = (decimal)rawPrice;
            return rate > 0m;
        }

        private static decimal CalculateSpread(decimal candidate, decimal reference) =>
            reference <= 0m
                ? decimal.MaxValue
                : Math.Abs(candidate - reference) / reference;

        private static DateTime GetObservedAtUtc(long unixTimeMs, DateTime fallbackUtc)
        {
            if (unixTimeMs <= 0)
            {
                return fallbackUtc;
            }

            try
            {
                return DateTimeOffset.FromUnixTimeMilliseconds(unixTimeMs).UtcDateTime;
            }
            catch
            {
                return fallbackUtc;
            }
        }

        private void RecalculateDependentTryPrices()
        {
            var nowUtc = DateTime.UtcNow;
            lock (_recalcLock)
            {
                if (nowUtc - _lastDependentRecalcAtUtc < DependentRecalcMinInterval)
                {
                    _logger.LogDebug(
                        "ForexHandler skipped dependent recalc due to throttle. intervalMs={IntervalMs}",
                        (int)DependentRecalcMinInterval.TotalMilliseconds);
                    return;
                }

                _lastDependentRecalcAtUtc = nowUtc;
            }

            try
            {
                _goldHandler.RecalculateTryFromForex();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ForexHandler failed to recalculate gold TRY prices after forex update.");
            }

            try
            {
                _cryptoHandler.RecalculateTryFromForex();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ForexHandler failed to recalculate crypto TRY prices after forex update.");
            }
        }
    }
#nullable restore
}
