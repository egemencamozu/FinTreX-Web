using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using Microsoft.Extensions.Logging;
using System;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
#nullable enable
    public sealed class BistIndexHandler
    {
        private readonly IMarketDataCache _cache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly ILogger<BistIndexHandler> _logger;

        public BistIndexHandler(IMarketDataCache cache, IMarketDataBroadcaster broadcaster, ILogger<BistIndexHandler> logger)
        {
            _cache = cache;
            _broadcaster = broadcaster;
            _logger = logger;
        }

        public void HandleYahoo(PricingData data)
        {
            if (data is null || string.IsNullOrWhiteSpace(data.Id))
            {
                _logger.LogWarning("BistIndexHandler ignored empty payload.");
                return;
            }

            var price = (decimal)data.Price;
            if (price <= 0m)
            {
                _logger.LogWarning("BistIndexHandler ignored non-positive price. ticker={Ticker} price={Price}", data.Id, data.Price);
                return;
            }

            var ticker = data.Id.Trim().ToUpperInvariant();
            var existing = _cache.GetIndex(ticker);
            var change = ResolveChange(data, price, existing);
            var changePercent = ResolveChangePercent(data, price, change, existing);
            var index = new IndexPrice
            {
                Ticker = ticker,
                Name = ResolveIndexName(data, existing),
                Price = price,
                Change = change,
                ChangePercent = changePercent,
                UpdatedAt = GetObservedAtUtc(data.Time, DateTime.UtcNow)
            };

            _cache.SetIndex(ticker, index);
            _broadcaster.BroadcastIndexUpdate(new IndexPriceDto
            {
                Ticker = index.Ticker,
                Name = index.Name,
                Price = index.Price,
                Change = index.Change,
                ChangePercent = index.ChangePercent,
                UpdatedAt = index.UpdatedAt
            }).SafeFireAndForget(_logger, "BroadcastIndexUpdate");
        }

        private static string ResolveIndexName(PricingData data, IndexPrice? existing)
        {
            if (!string.IsNullOrWhiteSpace(data.ShortName))
            {
                return data.ShortName;
            }

            return existing?.Name ?? string.Empty;
        }

        private static decimal ResolveChange(PricingData data, decimal price, IndexPrice? existing)
        {
            var incoming = (decimal)data.Change;
            if (incoming != 0m)
            {
                return incoming;
            }

            var prevClose = (decimal)data.PrevClose;
            if (prevClose > 0m)
            {
                return price - prevClose;
            }

            return existing?.Change ?? 0m;
        }

        private static decimal ResolveChangePercent(PricingData data, decimal price, decimal resolvedChange, IndexPrice? existing)
        {
            var incoming = (decimal)data.ChangePercent;
            if (incoming != 0m)
            {
                return incoming;
            }

            var prevClose = (decimal)data.PrevClose;
            if (prevClose > 0m)
            {
                return ((price - prevClose) / prevClose) * 100m;
            }

            var basePrice = price - resolvedChange;
            if (basePrice != 0m)
            {
                return (resolvedChange / basePrice) * 100m;
            }

            return existing?.ChangePercent ?? 0m;
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
