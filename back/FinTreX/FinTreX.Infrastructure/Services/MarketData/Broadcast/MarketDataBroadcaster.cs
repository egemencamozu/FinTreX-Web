using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.Broadcast
{
#nullable enable
    public sealed class MarketDataBroadcaster<THub> : IMarketDataBroadcaster
        where THub : Hub
    {
        private const int ThrottleMs = 1000;

        private readonly IHubContext<THub> _hubContext;
        private readonly ConcurrentDictionary<string, long> _lastBroadcast = new(StringComparer.OrdinalIgnoreCase);

        public MarketDataBroadcaster(IHubContext<THub> hubContext)
        {
            _hubContext = hubContext;
        }

        public Task BroadcastGoldUpdate(GoldPriceDto dto) =>
            _hubContext.Clients.All.SendAsync("GoldUpdated", dto);

        public Task BroadcastStockUpdate(StockPriceDto dto)
        {
            if (!ShouldBroadcast(dto.Ticker)) return Task.CompletedTask;
            return _hubContext.Clients.Group(dto.Ticker).SendAsync("StockUpdated", dto);
        }

        public Task BroadcastIndexUpdate(IndexPriceDto dto) =>
            _hubContext.Clients.All.SendAsync("IndexUpdated", dto);

        public Task BroadcastCryptoUpdate(CryptoPriceDto dto)
        {
            if (!ShouldBroadcast(dto.Symbol)) return Task.CompletedTask;
            return _hubContext.Clients.Group(dto.Symbol).SendAsync("CryptoUpdated", dto);
        }

        public Task BroadcastForexUpdate(ForexRateDto dto) =>
            _hubContext.Clients.All.SendAsync("ForexUpdated", dto);

        public Task BroadcastToGroup(string groupName, string method, object data) =>
            _hubContext.Clients.Group(groupName).SendAsync(method, data);

        private bool ShouldBroadcast(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return false;
            }

            var nowTicks = DateTime.UtcNow.Ticks;
            var thresholdTicks = TimeSpan.FromMilliseconds(ThrottleMs).Ticks;

            while (true)
            {
                if (_lastBroadcast.TryGetValue(key, out var lastTicks))
                {
                    if (nowTicks - lastTicks < thresholdTicks)
                    {
                        return false;
                    }

                    if (_lastBroadcast.TryUpdate(key, nowTicks, lastTicks))
                    {
                        return true;
                    }

                    continue;
                }

                if (_lastBroadcast.TryAdd(key, nowTicks))
                {
                    return true;
                }
            }
        }
    }
#nullable restore
}
