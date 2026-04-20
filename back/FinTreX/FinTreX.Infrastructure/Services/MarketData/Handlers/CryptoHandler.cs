using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
#nullable enable
    public sealed class CryptoHandler
    {
        private readonly IMarketDataCache _cache;
        private readonly IMarketDataBroadcaster _broadcaster;
        private readonly ICryptoMarketEnrichmentProvider _enrichmentProvider;
        private readonly ILogger<CryptoHandler> _logger;
        private readonly ConcurrentDictionary<string, decimal> _directTryByBase =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, RollingWindowState> _rollingBySymbol =
            new(StringComparer.OrdinalIgnoreCase);

        public CryptoHandler(
            IMarketDataCache cache,
            IMarketDataBroadcaster broadcaster,
            ICryptoMarketEnrichmentProvider enrichmentProvider,
            ILogger<CryptoHandler> logger)
        {
            _cache = cache;
            _broadcaster = broadcaster;
            _enrichmentProvider = enrichmentProvider;
            _logger = logger;
        }

        public void HandleMiniTicker(
            string symbol,
            decimal close,
            decimal open,
            decimal high,
            decimal low,
            decimal volume,
            DateTime updatedAtUtc)
        {
            if (string.IsNullOrWhiteSpace(symbol) || close <= 0m)
            {
                return;
            }

            var normalizedSymbol = symbol.Trim().ToUpperInvariant();
            if (normalizedSymbol == "USDTTRY")
            {
                // Routed to ForexHandler by Binance stream service.
                return;
            }

            var ticker = new BinanceMiniTicker(
                Symbol: normalizedSymbol,
                Close: close,
                Open: open,
                High: high,
                Low: low,
                Volume: volume,
                UpdatedAtUtc: updatedAtUtc);

            if (normalizedSymbol.EndsWith("TRY", StringComparison.Ordinal))
            {
                HandleTryPair(ticker);
                return;
            }

            if (normalizedSymbol.EndsWith("USDT", StringComparison.Ordinal))
            {
                HandleUsdtPair(ticker);
                return;
            }
        }

        public void HandleRollingWindowTicker(
            string symbol,
            decimal changePercent,
            int windowHours,
            DateTime updatedAtUtc)
        {
            if (string.IsNullOrWhiteSpace(symbol))
            {
                return;
            }

            var normalizedSymbol = symbol.Trim().ToUpperInvariant();
            if (!normalizedSymbol.EndsWith("USDT", StringComparison.Ordinal))
            {
                return;
            }

            if (windowHours != 1 && windowHours != 4)
            {
                return;
            }

            UpsertRollingWindowState(normalizedSymbol, changePercent, windowHours);

            var existing = _cache.GetCrypto(normalizedSymbol);
            if (existing is null)
            {
                return;
            }

            var updated = CloneWith(
                source: existing,
                priceTry: existing.PriceTry,
                trySource: existing.TrySource,
                updatedAtUtc: updatedAtUtc);

            var shouldUpdate = false;
            if (windowHours == 1 && updated.ChangePercent1h != changePercent)
            {
                updated.ChangePercent1h = changePercent;
                shouldUpdate = true;
            }
            else if (windowHours == 4 && updated.ChangePercent4h != changePercent)
            {
                updated.ChangePercent4h = changePercent;
                shouldUpdate = true;
            }

            if (!shouldUpdate)
            {
                return;
            }

            _cache.SetCrypto(normalizedSymbol, updated);
            _broadcaster.BroadcastCryptoUpdate(ToDto(updated))
                .SafeFireAndForget(_logger, "BroadcastCryptoUpdate");
        }

        public void RecalculateTryFromForex()
        {
            var usdTry = _cache.GetUsdTry();
            if (usdTry <= 0m)
            {
                return;
            }

            var nowUtc = DateTime.UtcNow;
            var cryptos = _cache.GetAllCryptoNoTouch();
            foreach (var crypto in cryptos)
            {
                decimal recalculatedPriceTry;
                string recalculatedSource;

                if (_directTryByBase.TryGetValue(crypto.BaseAsset, out var directTry) && directTry > 0m)
                {
                    recalculatedPriceTry = directTry;
                    recalculatedSource = "DIRECT";
                }
                else
                {
                    recalculatedPriceTry = crypto.PriceUsdt * usdTry;
                    recalculatedSource = "CALCULATED";
                }

                if (crypto.PriceTry == recalculatedPriceTry &&
                    string.Equals(crypto.TrySource, recalculatedSource, StringComparison.Ordinal))
                {
                    continue;
                }

                var updated = CloneWith(
                    source: crypto,
                    priceTry: recalculatedPriceTry,
                    trySource: recalculatedSource,
                    updatedAtUtc: nowUtc);

                _cache.SetCrypto(updated.Symbol, updated);
                _broadcaster.BroadcastCryptoUpdate(ToDto(updated))
                    .SafeFireAndForget(_logger, "BroadcastCryptoUpdate");
            }
        }

        private void HandleUsdtPair(BinanceMiniTicker ticker)
        {
            var symbol = ticker.Symbol.ToUpperInvariant();
            var baseAsset = symbol[..^4];
            var priceUsdt = ticker.Close;
            var existing = _cache.GetCrypto(symbol);

            var hasDirectTry = _directTryByBase.TryGetValue(baseAsset, out var directTry) && directTry > 0m;
            var usdTry = _cache.GetUsdTry();
            var priceTry = hasDirectTry ? directTry : (usdTry > 0m ? priceUsdt * usdTry : 0m);
            var trySource = hasDirectTry ? "DIRECT" : "CALCULATED";

            var crypto = new CryptoCurrency
            {
                Symbol = symbol,
                BaseAsset = baseAsset,
                PriceUsdt = priceUsdt,
                PriceTry = priceTry,
                Change24h = ticker.Close - ticker.Open,
                ChangePercent24h = CalculatePercent(ticker.Open, ticker.Close),
                ChangePercent1h = existing?.ChangePercent1h,
                ChangePercent4h = existing?.ChangePercent4h,
                Volume24h = ticker.Volume,
                High24h = ticker.High,
                Low24h = ticker.Low,
                TrySource = trySource,
                UpdatedAt = ticker.UpdatedAtUtc
            };

            ApplyRollingWindowState(crypto);
            ApplyEnrichment(crypto);
            _cache.SetCrypto(symbol, crypto);
            _broadcaster.BroadcastCryptoUpdate(ToDto(crypto))
                .SafeFireAndForget(_logger, "BroadcastCryptoUpdate");
        }

        private void HandleTryPair(BinanceMiniTicker ticker)
        {
            var symbol = ticker.Symbol.ToUpperInvariant();
            var baseAsset = symbol[..^3];
            _directTryByBase[baseAsset] = ticker.Close;

            var canonicalSymbol = baseAsset + "USDT";
            var existing = _cache.GetCrypto(canonicalSymbol);
            var priceUsdt = existing?.PriceUsdt ?? 0m;

            var updated = new CryptoCurrency
            {
                Symbol = canonicalSymbol,
                BaseAsset = baseAsset,
                PriceUsdt = priceUsdt,
                PriceTry = ticker.Close,
                // Keep USDT 24h metrics sourced from USDT stream; TRY ticks should only affect TRY price.
                Change24h = existing?.Change24h ?? 0m,
                ChangePercent24h = existing?.ChangePercent24h ?? 0m,
                ChangePercent1h = existing?.ChangePercent1h,
                ChangePercent4h = existing?.ChangePercent4h,
                Volume24h = existing?.Volume24h ?? 0m,
                High24h = existing?.High24h ?? 0m,
                Low24h = existing?.Low24h ?? 0m,
                TrySource = "DIRECT",
                UpdatedAt = ticker.UpdatedAtUtc
            };

            ApplyRollingWindowState(updated);
            ApplyEnrichment(updated);
            _cache.SetCrypto(canonicalSymbol, updated);
            _broadcaster.BroadcastCryptoUpdate(ToDto(updated))
                .SafeFireAndForget(_logger, "BroadcastCryptoUpdate");
        }

        private static CryptoCurrency CloneWith(
            CryptoCurrency source,
            decimal priceTry,
            string trySource,
            DateTime updatedAtUtc) =>
            new CryptoCurrency
            {
                Symbol = source.Symbol,
                BaseAsset = source.BaseAsset,
                PriceUsdt = source.PriceUsdt,
                PriceTry = priceTry,
                Change24h = source.Change24h,
                ChangePercent1h = source.ChangePercent1h,
                ChangePercent4h = source.ChangePercent4h,
                ChangePercent24h = source.ChangePercent24h,
                MarketCapUsdt = source.MarketCapUsdt,
                CirculatingSupply = source.CirculatingSupply,
                TotalSupply = source.TotalSupply,
                Network = source.Network,
                Volume24h = source.Volume24h,
                High24h = source.High24h,
                Low24h = source.Low24h,
                TrySource = trySource,
                UpdatedAt = updatedAtUtc
            };

        private void ApplyEnrichment(CryptoCurrency crypto)
        {
            var enrichment = _enrichmentProvider.GetBySymbol(crypto.Symbol);
            if (enrichment is null)
            {
                return;
            }

            crypto.CirculatingSupply = enrichment.CirculatingSupply;
            crypto.TotalSupply = enrichment.TotalSupply;
            crypto.Network = enrichment.Network;

            // Keep market cap live with streaming price whenever circulating supply is known.
            if (crypto.PriceUsdt > 0m &&
                enrichment.CirculatingSupply.HasValue &&
                enrichment.CirculatingSupply.Value > 0m)
            {
                crypto.MarketCapUsdt = crypto.PriceUsdt * enrichment.CirculatingSupply.Value;
                return;
            }

            crypto.MarketCapUsdt = enrichment.MarketCapUsdt;
        }

        private void UpsertRollingWindowState(string symbol, decimal changePercent, int windowHours)
        {
            _rollingBySymbol.AddOrUpdate(
                symbol,
                _ => windowHours == 1
                    ? new RollingWindowState(ChangePercent1h: changePercent, ChangePercent4h: null)
                    : new RollingWindowState(ChangePercent1h: null, ChangePercent4h: changePercent),
                (_, existing) =>
                {
                    return windowHours == 1
                        ? existing with { ChangePercent1h = changePercent }
                        : existing with { ChangePercent4h = changePercent };
                });
        }

        private void ApplyRollingWindowState(CryptoCurrency crypto)
        {
            if (!_rollingBySymbol.TryGetValue(crypto.Symbol, out var state))
            {
                return;
            }

            if (state.ChangePercent1h.HasValue)
            {
                crypto.ChangePercent1h = state.ChangePercent1h.Value;
            }

            if (state.ChangePercent4h.HasValue)
            {
                crypto.ChangePercent4h = state.ChangePercent4h.Value;
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

        private static decimal CalculatePercent(decimal open, decimal close)
        {
            if (open == 0m)
            {
                return 0m;
            }

            return ((close - open) / open) * 100m;
        }

        private readonly record struct BinanceMiniTicker(
            string Symbol,
            decimal Close,
            decimal Open,
            decimal High,
            decimal Low,
            decimal Volume,
            DateTime UpdatedAtUtc);

        private readonly record struct RollingWindowState(decimal? ChangePercent1h, decimal? ChangePercent4h);
    }
#nullable restore
}
