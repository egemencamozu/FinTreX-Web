using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using Microsoft.Extensions.Logging;
using System;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
#nullable enable
    public sealed class GoldHandler
    {
        private const decimal OunceToGram = 31.1035m;

        private readonly IMarketDataCache _cache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly ILogger<GoldHandler> _logger;

        public GoldHandler(IMarketDataCache cache, IMarketDataBroadcaster broadcaster, ILogger<GoldHandler> logger)
        {
            _cache = cache;
            _broadcaster = broadcaster;
            _logger = logger;
        }

        public void HandleBinance(decimal ounceUsd, DateTime observedAtUtc)
        {
            if (ounceUsd <= 0m)
            {
                _logger.LogWarning("GoldHandler ignored non-positive Binance price. price={Price}", ounceUsd);
                return;
            }

            var usdTry = _cache.GetForex("USDTRY");
            var usdTryRate = usdTry?.Rate ?? 0m;
            var gramUsd = ounceUsd / OunceToGram;
            var ounceTry = usdTryRate > 0m ? ounceUsd * usdTryRate : 0m;
            var gramTry = usdTryRate > 0m ? gramUsd * usdTryRate : 0m;
            var quality = usdTry?.Quality == ForexQuality.Primary ? "EXACT" : "APPROXIMATE";

            var gold = new GoldPrice
            {
                Symbol = "XAUUSD=X",
                OunceUsd = ounceUsd,
                OunceTry = ounceTry,
                GramUsd = gramUsd,
                GramTry = gramTry,
                PriceQuality = quality,
                UpdatedAt = observedAtUtc
            };

            _cache.SetGold("XAUUSD=X", gold);
            _broadcaster.BroadcastGoldUpdate(new GoldPriceDto
            {
                OunceUsd = gold.OunceUsd,
                OunceTry = gold.OunceTry,
                GramUsd = gold.GramUsd,
                GramTry = gold.GramTry,
                PriceQuality = gold.PriceQuality,
                UpdatedAt = gold.UpdatedAt
            }).SafeFireAndForget(_logger, "BroadcastGoldUpdate");
        }

        public void HandleYahoo(PricingData data)
        {
            if (data is null || string.IsNullOrWhiteSpace(data.Id))
            {
                _logger.LogWarning("GoldHandler ignored empty payload.");
                return;
            }

            var ounceUsd = (decimal)data.Price;
            if (ounceUsd <= 0m)
            {
                _logger.LogWarning("GoldHandler ignored non-positive price. ticker={Ticker} price={Price}", data.Id, data.Price);
                return;
            }

            var usdTry = _cache.GetForex("USDTRY");
            var usdTryRate = usdTry?.Rate ?? 0m;
            var gramUsd = ounceUsd / OunceToGram;
            var ounceTry = usdTryRate > 0m ? ounceUsd * usdTryRate : 0m;
            var gramTry = usdTryRate > 0m ? gramUsd * usdTryRate : 0m;
            var updatedAt = GetObservedAtUtc(data.Time, DateTime.UtcNow);
            var quality = usdTry?.Quality == ForexQuality.Primary ? "EXACT" : "APPROXIMATE";

            var gold = new GoldPrice
            {
                Symbol = data.Id.Trim().ToUpperInvariant(),
                OunceUsd = ounceUsd,
                OunceTry = ounceTry,
                GramUsd = gramUsd,
                GramTry = gramTry,
                PriceQuality = quality,
                UpdatedAt = updatedAt
            };

            _cache.SetGold(data.Id, gold);
            _broadcaster.BroadcastGoldUpdate(new GoldPriceDto
            {
                OunceUsd = gold.OunceUsd,
                OunceTry = gold.OunceTry,
                GramUsd = gold.GramUsd,
                GramTry = gold.GramTry,
                PriceQuality = gold.PriceQuality,
                UpdatedAt = gold.UpdatedAt
            }).SafeFireAndForget(_logger, "BroadcastGoldUpdate");
        }

        public void RecalculateTryFromForex()
        {
            var usdTry = _cache.GetForex("USDTRY");
            if (usdTry is null || usdTry.Rate <= 0m)
            {
                return;
            }

            var allGold = _cache.GetAllGoldNoTouch();
            var quality = usdTry.Quality == ForexQuality.Primary ? "EXACT" : "APPROXIMATE";
            foreach (var gold in allGold)
            {
                var ounceTry = gold.OunceUsd * usdTry.Rate;
                var gramTry = gold.GramUsd * usdTry.Rate;

                if (gold.OunceTry == ounceTry &&
                    gold.GramTry == gramTry &&
                    string.Equals(gold.PriceQuality, quality, StringComparison.Ordinal))
                {
                    continue;
                }

                var updated = new GoldPrice
                {
                    Symbol = gold.Symbol,
                    OunceUsd = gold.OunceUsd,
                    GramUsd = gold.GramUsd,
                    OunceTry = ounceTry,
                    GramTry = gramTry,
                    PriceQuality = quality,
                    UpdatedAt = DateTime.UtcNow
                };

                _cache.SetGold(updated.Symbol, updated);
                _broadcaster.BroadcastGoldUpdate(new GoldPriceDto
                {
                    OunceUsd = updated.OunceUsd,
                    OunceTry = updated.OunceTry,
                    GramUsd = updated.GramUsd,
                    GramTry = updated.GramTry,
                    PriceQuality = updated.PriceQuality,
                    UpdatedAt = updated.UpdatedAt
                }).SafeFireAndForget(_logger, "BroadcastGoldUpdate");
            }
        }

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
    }
#nullable restore
}
