using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using FinTreX.Infrastructure.Services.MarketData.Symbols;
using Microsoft.Extensions.Logging;
using System;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
#nullable enable
    public sealed class BistStockHandler
    {
        private readonly IMarketDataCache _cache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly IBistSymbolProvider _symbolProvider;
        private readonly ILogger<BistStockHandler> _logger;

        public BistStockHandler(
            IMarketDataCache cache,
            IMarketDataBroadcaster broadcaster,
            IBistSymbolProvider symbolProvider,
            ILogger<BistStockHandler> logger)
        {
            _cache = cache;
            _broadcaster = broadcaster;
            _symbolProvider = symbolProvider;
            _logger = logger;
        }

        public void HandleYahoo(PricingData data)
        {
            if (data is null || string.IsNullOrWhiteSpace(data.Id))
            {
                _logger.LogWarning("BistStockHandler ignored empty payload.");
                return;
            }

            var price = (decimal)data.Price;
            if (price <= 0m)
            {
                _logger.LogWarning("BistStockHandler ignored non-positive price. ticker={Ticker} price={Price}", data.Id, data.Price);
                return;
            }

            var ticker = data.Id.Trim().ToUpperInvariant();
            var existing = _cache.GetStock(ticker);
            var symbolInfo = _symbolProvider.GetSymbolInfo(ticker);
            var change = ResolveChange(data, price, existing);
            var changePercent = ResolveChangePercent(data, price, change, existing);
            var volume = ResolveDayVolume(data, existing);

            var stock = new StockPrice
            {
                Ticker = ticker,
                CompanyName = ResolveCompanyName(data, existing, symbolInfo),
                Sector = ResolveSector(existing, symbolInfo),
                Price = price,
                Change = change,
                ChangePercent = changePercent,
                Volume = volume,
                UpdatedAt = GetObservedAtUtc(data.Time, DateTime.UtcNow)
            };

            _cache.SetStock(ticker, stock);
            _broadcaster.BroadcastStockUpdate(new StockPriceDto
            {
                Ticker = stock.Ticker,
                CompanyName = stock.CompanyName,
                Price = stock.Price,
                Change = stock.Change,
                ChangePercent = stock.ChangePercent,
                Sector = stock.Sector,
                Volume = stock.Volume,
                UpdatedAt = stock.UpdatedAt
            }).SafeFireAndForget(_logger, "BroadcastStockUpdate");
        }

        private static string ResolveCompanyName(PricingData data, StockPrice? existing, BistSymbolInfo? symbolInfo)
        {
            if (!string.IsNullOrWhiteSpace(data.ShortName))
            {
                return data.ShortName;
            }

            if (!string.IsNullOrWhiteSpace(existing?.CompanyName))
            {
                return existing.CompanyName;
            }

            return symbolInfo?.CompanyName ?? string.Empty;
        }

        private static string ResolveSector(StockPrice? existing, BistSymbolInfo? symbolInfo)
        {
            if (!string.IsNullOrWhiteSpace(existing?.Sector))
            {
                return existing.Sector;
            }

            return symbolInfo?.Sector ?? string.Empty;
        }

        private static decimal ResolveChange(PricingData data, decimal price, StockPrice? existing)
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

        private static decimal ResolveChangePercent(PricingData data, decimal price, decimal resolvedChange, StockPrice? existing)
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

        private static long ResolveDayVolume(PricingData data, StockPrice? existing)
        {
            if (data.DayVolume > 0)
            {
                return data.DayVolume;
            }

            return existing?.Volume ?? 0L;
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
