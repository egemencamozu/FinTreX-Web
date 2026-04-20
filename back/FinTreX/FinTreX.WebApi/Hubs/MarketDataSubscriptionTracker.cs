using System;
using System.Collections.Generic;

namespace FinTreX.WebApi.Hubs
{
    /// <summary>
    /// Tracks active SignalR subscriptions per connection and cache key.
    /// </summary>
    public sealed class MarketDataSubscriptionTracker : IMarketDataSubscriptionTracker
    {
        private readonly object _syncRoot = new();
        private readonly Dictionary<string, HashSet<string>> _connectionSubscriptions =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _subscriberCounts =
            new(StringComparer.OrdinalIgnoreCase);

        public int TrackSubscribe(string connectionId, string cacheKey)
        {
            if (string.IsNullOrWhiteSpace(connectionId) || string.IsNullOrWhiteSpace(cacheKey))
            {
                return 0;
            }

            lock (_syncRoot)
            {
                if (!_connectionSubscriptions.TryGetValue(connectionId, out var subscriptions))
                {
                    subscriptions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    _connectionSubscriptions[connectionId] = subscriptions;
                }

                if (!subscriptions.Add(cacheKey))
                {
                    return _subscriberCounts.TryGetValue(cacheKey, out var existingCount)
                        ? existingCount
                        : 0;
                }

                if (_subscriberCounts.TryGetValue(cacheKey, out var count))
                {
                    count++;
                    _subscriberCounts[cacheKey] = count;
                    return count;
                }

                _subscriberCounts[cacheKey] = 1;
                return 1;
            }
        }

        public int TrackUnsubscribe(string connectionId, string cacheKey)
        {
            if (string.IsNullOrWhiteSpace(connectionId) || string.IsNullOrWhiteSpace(cacheKey))
            {
                return 0;
            }

            lock (_syncRoot)
            {
                if (!_connectionSubscriptions.TryGetValue(connectionId, out var subscriptions))
                {
                    return _subscriberCounts.TryGetValue(cacheKey, out var existingCount)
                        ? existingCount
                        : 0;
                }

                if (!subscriptions.Remove(cacheKey))
                {
                    return _subscriberCounts.TryGetValue(cacheKey, out var existingCount)
                        ? existingCount
                        : 0;
                }

                if (subscriptions.Count == 0)
                {
                    _connectionSubscriptions.Remove(connectionId);
                }

                if (!_subscriberCounts.TryGetValue(cacheKey, out var count))
                {
                    return 0;
                }

                count--;
                if (count <= 0)
                {
                    _subscriberCounts.Remove(cacheKey);
                    return 0;
                }

                _subscriberCounts[cacheKey] = count;
                return count;
            }
        }

        public IReadOnlyList<string> RemoveConnection(string connectionId)
        {
            if (string.IsNullOrWhiteSpace(connectionId))
            {
                return Array.Empty<string>();
            }

            lock (_syncRoot)
            {
                if (!_connectionSubscriptions.TryGetValue(connectionId, out var subscriptions))
                {
                    return Array.Empty<string>();
                }

                _connectionSubscriptions.Remove(connectionId);

                var becameInactive = new List<string>();
                foreach (var cacheKey in subscriptions)
                {
                    if (!_subscriberCounts.TryGetValue(cacheKey, out var count))
                    {
                        continue;
                    }

                    count--;
                    if (count <= 0)
                    {
                        _subscriberCounts.Remove(cacheKey);
                        becameInactive.Add(cacheKey);
                    }
                    else
                    {
                        _subscriberCounts[cacheKey] = count;
                    }
                }

                return becameInactive;
            }
        }
    }
}
