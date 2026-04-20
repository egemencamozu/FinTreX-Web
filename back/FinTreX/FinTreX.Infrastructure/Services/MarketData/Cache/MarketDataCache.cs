using FinTreX.Core.Interfaces;
using FinTreX.Core.Models.MarketData;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace FinTreX.Infrastructure.Services.MarketData.Cache
{
#nullable enable
    /// <summary>
    /// In-memory market data cache with key metadata tracking.
    /// TTL is intentionally disabled; cache keeps latest snapshot values.
    /// </summary>
    public sealed class MarketDataCache : IMarketDataCache
    {
        private const string GoldPrefix = "gold:";
        private const string StockPrefix = "stock:";
        private const string IndexPrefix = "index:";
        private const string CryptoPrefix = "crypto:";
        private const string ForexPrefix = "forex:";

        private readonly IMemoryCache _memoryCache;
        private readonly ConcurrentDictionary<string, CacheEntryMetadata> _keyMetadata;
        private int _expectedCryptoSymbolCount;

        public MarketDataCache(IMemoryCache memoryCache)
        {
            _memoryCache = memoryCache;
            _keyMetadata = new ConcurrentDictionary<string, CacheEntryMetadata>(StringComparer.OrdinalIgnoreCase);
        }

        public GoldPrice? GetGold(string symbol) =>
            GetValue<GoldPrice>(BuildKey(GoldPrefix, symbol));

        public void SetGold(string symbol, GoldPrice price) =>
            SetValue(BuildKey(GoldPrefix, symbol), price);

        public IReadOnlyList<GoldPrice> GetAllGold() =>
            GetValuesByPrefix<GoldPrice>(GoldPrefix, touch: true);

        public IReadOnlyList<GoldPrice> GetAllGoldNoTouch() =>
            GetValuesByPrefix<GoldPrice>(GoldPrefix, touch: false);

        public StockPrice? GetStock(string ticker) =>
            GetValue<StockPrice>(BuildKey(StockPrefix, ticker));

        public void SetStock(string ticker, StockPrice price) =>
            SetValue(BuildKey(StockPrefix, ticker), price);

        public IReadOnlyList<StockPrice> GetAllStocks() =>
            GetValuesByPrefix<StockPrice>(StockPrefix, touch: true);

        public IndexPrice? GetIndex(string ticker) =>
            GetValue<IndexPrice>(BuildKey(IndexPrefix, ticker));

        public void SetIndex(string ticker, IndexPrice price) =>
            SetValue(BuildKey(IndexPrefix, ticker), price);

        public IReadOnlyList<IndexPrice> GetAllIndices() =>
            GetValuesByPrefix<IndexPrice>(IndexPrefix, touch: true);

        public CryptoCurrency? GetCrypto(string symbol) =>
            GetValue<CryptoCurrency>(BuildKey(CryptoPrefix, symbol));

        public void SetCrypto(string symbol, CryptoCurrency price) =>
            SetValue(BuildKey(CryptoPrefix, symbol), price);

        public IReadOnlyList<CryptoCurrency> GetAllCrypto() =>
            GetValuesByPrefix<CryptoCurrency>(CryptoPrefix, touch: true);

        public IReadOnlyList<CryptoCurrency> GetAllCryptoNoTouch() =>
            GetValuesByPrefix<CryptoCurrency>(CryptoPrefix, touch: false);

        public int GetExpectedCryptoSymbolCount() =>
            Volatile.Read(ref _expectedCryptoSymbolCount);

        public void SetExpectedCryptoSymbolCount(int count) =>
            Volatile.Write(ref _expectedCryptoSymbolCount, Math.Max(0, count));

        public ForexRate? GetForex(string pair) =>
            GetValue<ForexRate>(BuildKey(ForexPrefix, pair));

        public void SetForex(string pair, ForexRate rate) =>
            SetValue(BuildKey(ForexPrefix, pair), rate);

        public decimal GetUsdTry()
        {
            var usdTry = GetForex("USDTRY");
            return usdTry?.Rate ?? 0m;
        }

        /// <summary>
        /// Removes stale metadata entries whose cache value no longer exists.
        /// </summary>
        public int SweepStaleMetadata(TimeSpan staleTtl, DateTime utcNow)
        {
            if (staleTtl <= TimeSpan.Zero)
            {
                return 0;
            }

            var cutoff = utcNow - staleTtl;
            var metadataKeysToRemove = _keyMetadata
                .Where(kvp => !IsEntryAlive(kvp.Key) && kvp.Value.LastAccessedAt <= cutoff)
                .Select(kvp => kvp.Key)
                .ToArray();

            var removedCount = 0;
            foreach (var key in metadataKeysToRemove)
            {
                if (_keyMetadata.TryRemove(key, out _))
                {
                    removedCount++;
                }
            }

            return removedCount;
        }

        private void SetValue<T>(string key, T value) where T : class
        {
            var now = DateTime.UtcNow;
            _memoryCache.Set(key, value);

            _keyMetadata.AddOrUpdate(
                key,
                _ => new CacheEntryMetadata(CreatedAt: now, LastAccessedAt: now),
                (_, existing) => existing.WithLastAccessed(now));
        }

        private T? GetValue<T>(string key) where T : class
        {
            if (_memoryCache.TryGetValue(key, out T? value) && value is not null)
            {
                Touch(key);
                return value;
            }

            _keyMetadata.TryRemove(key, out _);
            return null;
        }

        private IReadOnlyList<T> GetValuesByPrefix<T>(string prefix, bool touch) where T : class
        {
            var results = new List<T>();
            var keys = _keyMetadata.Keys
                .Where(key => key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                .ToArray();

            foreach (var key in keys)
            {
                if (_memoryCache.TryGetValue(key, out T? value) && value is not null)
                {
                    results.Add(value);
                    if (touch)
                    {
                        Touch(key);
                    }
                }
                else
                {
                    _keyMetadata.TryRemove(key, out _);
                }
            }

            return results;
        }

        private void Touch(string key)
        {
            var now = DateTime.UtcNow;
            _keyMetadata.AddOrUpdate(
                key,
                _ => new CacheEntryMetadata(CreatedAt: now, LastAccessedAt: now),
                (_, existing) => existing.WithLastAccessed(now));
        }

        private bool IsEntryAlive(string key) =>
            _memoryCache.TryGetValue(key, out object? value) && value is not null;

        private static string BuildKey(string prefix, string rawKey) =>
            string.Concat(prefix, NormalizeSymbol(rawKey));

        private static string NormalizeSymbol(string rawValue) =>
            string.IsNullOrWhiteSpace(rawValue)
                ? string.Empty
                : rawValue.Trim().ToUpperInvariant();

        private readonly record struct CacheEntryMetadata(
            DateTime CreatedAt,
            DateTime LastAccessedAt)
        {
            public CacheEntryMetadata WithLastAccessed(DateTime timestamp) =>
                this with { LastAccessedAt = timestamp };
        }
    }
#nullable restore
}
