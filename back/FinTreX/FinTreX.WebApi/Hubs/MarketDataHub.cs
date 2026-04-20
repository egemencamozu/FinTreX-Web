using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Hubs
{
    [Authorize]
    public class MarketDataHub : Hub
    {
        private const string StockPrefix = "stock:";
        private const string CryptoPrefix = "crypto:";
        private const int MaxBatchSubscriptions = 2000;
        private const int MaxTickerLength = 24;

        private readonly IMarketDataSubscriptionTracker _subscriptionTracker;

        public MarketDataHub(IMarketDataSubscriptionTracker subscriptionTracker)
        {
            _subscriptionTracker = subscriptionTracker;
        }

        public Task SubscribeToStock(string ticker)
        {
            var normalized = NormalizeAndValidateTicker(ticker, "ticker");
            return SubscribeToGroupAsync(normalized, StockPrefix);
        }

        public Task UnsubscribeFromStock(string ticker)
        {
            var normalized = NormalizeAndValidateTicker(ticker, "ticker");
            return UnsubscribeFromGroupAsync(normalized, StockPrefix);
        }

        public async Task SubscribeToStocks(IEnumerable<string> tickers)
        {
            if (tickers is null) return;
            var unique = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var receivedCount = 0;
            foreach (var ticker in tickers)
            {
                receivedCount++;
                if (receivedCount > MaxBatchSubscriptions)
                {
                    throw new HubException($"Too many tickers. Max allowed is {MaxBatchSubscriptions}.");
                }

                var normalized = NormalizeAndValidateTicker(ticker, "ticker");
                if (!unique.Add(normalized))
                {
                    continue;
                }

                await SubscribeToGroupAsync(normalized, StockPrefix);
            }
        }

        public Task SubscribeToCrypto(string symbol)
        {
            var normalized = NormalizeAndValidateTicker(symbol, "symbol");
            return SubscribeToGroupAsync(normalized, CryptoPrefix);
        }

        public Task UnsubscribeFromCrypto(string symbol)
        {
            var normalized = NormalizeAndValidateTicker(symbol, "symbol");
            return UnsubscribeFromGroupAsync(normalized, CryptoPrefix);
        }

        public async Task SubscribeToCryptos(IEnumerable<string> symbols)
        {
            if (symbols is null) return;
            var unique = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var receivedCount = 0;
            foreach (var symbol in symbols)
            {
                receivedCount++;
                if (receivedCount > MaxBatchSubscriptions)
                {
                    throw new HubException($"Too many symbols. Max allowed is {MaxBatchSubscriptions}.");
                }

                var normalized = NormalizeAndValidateTicker(symbol, "symbol");
                if (!unique.Add(normalized))
                {
                    continue;
                }

                await SubscribeToGroupAsync(normalized, CryptoPrefix);
            }
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _subscriptionTracker.RemoveConnection(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }

        private async Task SubscribeToGroupAsync(string normalizedGroup, string cachePrefix)
        {
            if (string.IsNullOrEmpty(normalizedGroup))
            {
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, normalizedGroup);

            var cacheKey = BuildCacheKey(cachePrefix, normalizedGroup);
            _subscriptionTracker.TrackSubscribe(Context.ConnectionId, cacheKey);
        }

        private async Task UnsubscribeFromGroupAsync(string normalizedGroup, string cachePrefix)
        {
            if (string.IsNullOrEmpty(normalizedGroup))
            {
                return;
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, normalizedGroup);

            var cacheKey = BuildCacheKey(cachePrefix, normalizedGroup);
            _subscriptionTracker.TrackUnsubscribe(Context.ConnectionId, cacheKey);
        }

        private static string BuildCacheKey(string prefix, string normalizedSymbol) =>
            string.Concat(prefix, normalizedSymbol);

        private static string NormalizeAndValidateTicker(string rawValue, string fieldName)
        {
            var normalized = (rawValue ?? string.Empty).Trim().ToUpperInvariant();
            if (normalized.Length == 0)
            {
                throw new HubException($"{fieldName} is required.");
            }

            if (normalized.Length > MaxTickerLength)
            {
                throw new HubException($"{fieldName} is too long. Max length is {MaxTickerLength}.");
            }

            foreach (var ch in normalized)
            {
                var valid = char.IsLetterOrDigit(ch) || ch == '.' || ch == '=' || ch == '-';
                if (!valid)
                {
                    throw new HubException($"{fieldName} contains invalid characters.");
                }
            }

            return normalized;
        }
    }
}
