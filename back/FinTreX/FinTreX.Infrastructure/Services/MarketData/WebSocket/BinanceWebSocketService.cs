using FinTreX.Core.Settings;
using FinTreX.Core.Interfaces;
using FinTreX.Infrastructure.Services.MarketData.Handlers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Buffers;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.WebSocket
{
#nullable enable
    public sealed class BinanceWebSocketService : BackgroundService
    {
        private const string ServiceName = nameof(BinanceWebSocketService);
        private const string UsdtTrySymbol = "USDTTRY";
        private const string XautUsdtSymbol = "XAUTUSDT";
        private const string ExchangeInfoUrl = "https://api.binance.com/api/v3/exchangeInfo";
        private const int SubscribeChunkSize = 100;
        private static readonly TimeSpan ExchangeInfoRefreshInterval = TimeSpan.FromMinutes(30);
        private static readonly SocketsHttpHandler ExchangeInfoHttpHandler = new()
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2)
        };
        private static readonly HttpClient ExchangeInfoHttpClient = new(ExchangeInfoHttpHandler)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };

        private readonly MarketDataSettings _settings;
        private readonly ForexHandler _forexHandler;
        private readonly CryptoHandler _cryptoHandler;
        private readonly GoldHandler _goldHandler;
        private readonly IMarketDataCache _marketDataCache;
        private readonly ILogger<BinanceWebSocketService> _logger;
        private readonly SemaphoreSlim _streamRefreshLock = new(1, 1);
        private IReadOnlyList<string> _cachedStreams = Array.Empty<string>();
        private DateTime _cachedStreamsUpdatedAtUtc = DateTime.MinValue;

        public BinanceWebSocketService(
            IOptions<MarketDataSettings> settings,
            ForexHandler forexHandler,
            CryptoHandler cryptoHandler,
            GoldHandler goldHandler,
            IMarketDataCache marketDataCache,
            ILogger<BinanceWebSocketService> logger)
        {
            _settings = settings.Value;
            _forexHandler = forexHandler;
            _cryptoHandler = cryptoHandler;
            _goldHandler = goldHandler;
            _marketDataCache = marketDataCache;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var reconnectAttempt = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                var streams = await ResolveStreamsAsync(stoppingToken);
                var expectedCryptoSymbols = streams.Count(s =>
                    s.EndsWith("usdt", StringComparison.OrdinalIgnoreCase) &&
                    !s.Equals(XautUsdtSymbol, StringComparison.OrdinalIgnoreCase));
                _marketDataCache.SetExpectedCryptoSymbolCount(expectedCryptoSymbols > 0 ? expectedCryptoSymbols : streams.Count);
                if (streams.Count == 0)
                {
                    _logger.LogWarning("{ServiceName}: no streams resolved, retrying in 30s.", ServiceName);
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                    continue;
                }

                var baseUrl = (_settings.BinanceWebSocketUrl?.Trim() is { Length: > 0 } url)
                    ? url
                    : "wss://stream.binance.com:9443/stream";

                using var socket = new ClientWebSocket();

                try
                {
                    _logger.LogInformation(
                        "{ServiceName}: connecting to {Url} (streams={StreamCount})",
                        ServiceName, baseUrl, streams.Count);

                    await socket.ConnectAsync(new Uri(baseUrl), stoppingToken);
                    reconnectAttempt = 0;

                    _logger.LogInformation("{ServiceName}: connected.", ServiceName);

                    await SubscribeAsync(socket, streams, stoppingToken);
                    // Seed before entering receive loop so dependent services can observe a populated cache deterministically.
                    await SeedInitialSnapshotAsync(streams, stoppingToken);
                    await ReceiveLoopAsync(socket, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    reconnectAttempt++;
                    var delay = GetReconnectDelay(reconnectAttempt);

                    _logger.LogWarning(
                        ex,
                        "{ServiceName}: stream error. Reconnect attempt {Attempt} in {DelaySeconds}s.",
                        ServiceName, reconnectAttempt, (int)delay.TotalSeconds);

                    await Task.Delay(delay, stoppingToken);
                }
                finally
                {
                    await TryCloseSocketAsync(socket, stoppingToken);
                }
            }
        }

        private async Task<IReadOnlyList<string>> ResolveStreamsAsync(CancellationToken cancellationToken)
        {
            if (IsStreamCacheFresh())
            {
                return _cachedStreams;
            }

            await _streamRefreshLock.WaitAsync(cancellationToken);
            try
            {
                if (IsStreamCacheFresh())
                {
                    return _cachedStreams;
                }

                IReadOnlyList<string> refreshed;
                try
                {
                    refreshed = await FetchAllStreamsFromExchangeAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "{ServiceName}: exchange info refresh failed.", ServiceName);
                    refreshed = Array.Empty<string>();
                }

                if (refreshed.Count > 0)
                {
                    _cachedStreams = refreshed;
                    _cachedStreamsUpdatedAtUtc = DateTime.UtcNow;
                    return _cachedStreams;
                }

                if (_cachedStreams.Count > 0)
                {
                    _cachedStreamsUpdatedAtUtc = DateTime.UtcNow;
                    _logger.LogWarning(
                        "{ServiceName}: using stale stream cache ({Count} streams) due to refresh failure.",
                        ServiceName,
                        _cachedStreams.Count);
                    return _cachedStreams;
                }

                var fallback = GetConfigFallbackStreams();
                _cachedStreams = fallback;
                _cachedStreamsUpdatedAtUtc = DateTime.UtcNow;

                _logger.LogWarning(
                    "{ServiceName}: exchange info unavailable, using config fallback streams ({Count}).",
                    ServiceName,
                    fallback.Count);

                return _cachedStreams;
            }
            finally
            {
                _streamRefreshLock.Release();
            }
        }

        private bool IsStreamCacheFresh() =>
            _cachedStreams.Count > 0 &&
            DateTime.UtcNow - _cachedStreamsUpdatedAtUtc < ExchangeInfoRefreshInterval;

        private async Task<IReadOnlyList<string>> FetchAllStreamsFromExchangeAsync(CancellationToken cancellationToken)
        {
            var streams = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // Always include gold and TRY pairs explicitly.
            streams.Add(XautUsdtSymbol.ToLowerInvariant());

            foreach (var pair in _settings.CryptoTryPairs ?? new List<string>())
            {
                if (!string.IsNullOrWhiteSpace(pair))
                    streams.Add(pair.Trim().ToLowerInvariant());
            }

            var json = await ExchangeInfoHttpClient.GetStringAsync(ExchangeInfoUrl, cancellationToken);

            using var doc = JsonDocument.Parse(json);
            var symbols = doc.RootElement.GetProperty("symbols");

            foreach (var symbol in symbols.EnumerateArray())
            {
                if (!symbol.TryGetProperty("status", out var status) ||
                    status.GetString() != "TRADING")
                    continue;

                if (!symbol.TryGetProperty("quoteAsset", out var quote) ||
                    quote.GetString() != "USDT")
                    continue;

                if (!symbol.TryGetProperty("symbol", out var sym))
                    continue;

                var pair = sym.GetString()?.ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(pair))
                    streams.Add(pair);
            }

            _logger.LogInformation(
                "{ServiceName}: refreshed {Count} streams from Binance exchange info.",
                ServiceName,
                streams.Count);

            return streams.OrderBy(s => s).ToArray();
        }

        private IReadOnlyList<string> GetConfigFallbackStreams()
        {
            var streams = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            streams.Add(XautUsdtSymbol.ToLowerInvariant());

            foreach (var pair in _settings.CryptoTryPairs ?? new List<string>())
            {
                if (!string.IsNullOrWhiteSpace(pair))
                {
                    streams.Add(pair.Trim().ToLowerInvariant());
                }
            }

            foreach (var pair in _settings.CryptoUsdtPairs ?? new List<string>())
            {
                if (!string.IsNullOrWhiteSpace(pair))
                {
                    streams.Add(pair.Trim().ToLowerInvariant());
                }
            }

            return streams.OrderBy(s => s).ToArray();
        }

        private async Task SubscribeAsync(ClientWebSocket socket, IReadOnlyList<string> streams, CancellationToken cancellationToken)
        {
            var params_ = streams.Select(s => $"{s}@miniTicker").ToArray();
            var chunks = params_.Chunk(SubscribeChunkSize).ToArray();
            var requestId = 1;

            foreach (var chunk in chunks)
            {
                var payload = JsonSerializer.Serialize(new
                {
                    method = "SUBSCRIBE",
                    @params = chunk,
                    id = requestId++
                });

                var bytes = Encoding.UTF8.GetBytes(payload);
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);

                _logger.LogInformation(
                    "{ServiceName}: subscribed chunk {Chunk}/{Total} ({Count} streams).",
                    ServiceName, requestId - 1, chunks.Length, chunk.Length);

                await Task.Delay(200, cancellationToken);
            }

            // Subscribe to rolling window ticker streams for 1h and 4h percent change.
            var rollingPayload = JsonSerializer.Serialize(new
            {
                method = "SUBSCRIBE",
                @params = new[] { "!ticker_1h@arr", "!ticker_4h@arr" },
                id = requestId
            });
            var rollingBytes = Encoding.UTF8.GetBytes(rollingPayload);
            await socket.SendAsync(new ArraySegment<byte>(rollingBytes), WebSocketMessageType.Text, true, cancellationToken);
            _logger.LogInformation("{ServiceName}: subscribed to rolling window streams (!ticker_1h@arr, !ticker_4h@arr).", ServiceName);
        }

        private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var buffer = ArrayPool<byte>.Shared.Rent(8 * 1024);
            try
            {
                using var messageStream = new MemoryStream(8 * 1024);
                while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
                {
                    var message = await ReceiveTextMessageAsync(socket, buffer, messageStream, cancellationToken);
                    if (message is null)
                    {
                        _logger.LogWarning("{ServiceName}: websocket closed by remote host.", ServiceName);
                        break;
                    }

                    if (IsSubscribeResponse(message))
                        continue;

                    if (TryReadRollingWindowArray(message, out var windowHours, out var rollingFrames))
                    {
                        var rollingNow = DateTime.UtcNow;
                        foreach (var rf in rollingFrames)
                        {
                            _cryptoHandler.HandleRollingWindowTicker(rf.Symbol, rf.PriceChangePercent, windowHours, rollingNow);
                        }
                        continue;
                    }

                    if (!TryReadMiniTickerFrame(message, out var frame))
                        continue;

                    if (frame.Symbol == UsdtTrySymbol)
                    {
                        _forexHandler.TryHandleBinanceFallback(frame.ClosePrice, frame.ObservedAtUtc);
                        continue;
                    }

                    if (frame.Symbol == XautUsdtSymbol)
                    {
                        _goldHandler.HandleBinance(frame.ClosePrice, frame.ObservedAtUtc);
                        continue;
                    }

                    _cryptoHandler.HandleMiniTicker(
                        frame.Symbol,
                        frame.ClosePrice,
                        frame.OpenPrice,
                        frame.HighPrice,
                        frame.LowPrice,
                        frame.Volume,
                        frame.ObservedAtUtc);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        private async Task SeedInitialSnapshotAsync(IReadOnlyList<string> streams, CancellationToken cancellationToken)
        {
            try
            {
                var usdtSymbols = streams
                    .Select(s => s.ToUpperInvariant())
                    .Where(s => s.EndsWith("USDT", StringComparison.Ordinal))
                    .ToArray();

                if (usdtSymbols.Length == 0) return;

                var now = DateTime.UtcNow;
                var totalCount = 0;
                const int chunkSize = 100;

                foreach (var chunk in usdtSymbols.Chunk(chunkSize))
                {
                    var jsonArray = System.Text.Json.JsonSerializer.Serialize(chunk);
                    var encodedSymbols = Uri.EscapeDataString(jsonArray);
                    var url = $"https://api.binance.com/api/v3/ticker/24hr?symbols={encodedSymbols}";

                    using var response = await ExchangeInfoHttpClient.GetAsync(url, cancellationToken);
                    if (!response.IsSuccessStatusCode)
                    {
                        // Retry symbol by symbol to skip any invalid ones
                        foreach (var symbol in chunk)
                        {
                            var singleEncoded = $"%5B%22{symbol}%22%5D";
                            var singleUrl = $"https://api.binance.com/api/v3/ticker/24hr?symbols={singleEncoded}";
                            try
                            {
                                using var sr = await ExchangeInfoHttpClient.GetAsync(singleUrl, cancellationToken);
                                if (!sr.IsSuccessStatusCode) continue;
                                using var ss = await sr.Content.ReadAsStreamAsync(cancellationToken);
                                using var sd = await JsonDocument.ParseAsync(ss, cancellationToken: cancellationToken);
                                if (sd.RootElement.ValueKind != JsonValueKind.Array) continue;
                                foreach (var item in sd.RootElement.EnumerateArray())
                                {
                                    var sym = GetString(item, "symbol");
                                    if (string.IsNullOrEmpty(sym)) continue;
                                    var lp = GetDecimal(item, "lastPrice");
                                    if (lp <= 0m) continue;
                                    if (sym.Equals(XautUsdtSymbol, StringComparison.OrdinalIgnoreCase))
                                        _goldHandler.HandleBinance(lp, now);
                                    else
                                        _cryptoHandler.HandleMiniTicker(sym, lp, GetDecimal(item, "openPrice"), GetDecimal(item, "highPrice"), GetDecimal(item, "lowPrice"), GetDecimal(item, "quoteVolume"), now);
                                    totalCount++;
                                }
                            }
                            catch { }
                        }
                        continue;
                    }

                    using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

                    if (doc.RootElement.ValueKind != JsonValueKind.Array) continue;

                    foreach (var item in doc.RootElement.EnumerateArray())
                    {
                        var symbol = GetString(item, "symbol");
                        if (string.IsNullOrEmpty(symbol)) continue;

                        var lastPrice = GetDecimal(item, "lastPrice");
                        if (lastPrice <= 0m) continue;

                        if (symbol.Equals(XautUsdtSymbol, StringComparison.OrdinalIgnoreCase))
                        {
                            _goldHandler.HandleBinance(lastPrice, now);
                            totalCount++;
                            continue;
                        }

                        var openPrice = GetDecimal(item, "openPrice");
                        var highPrice = GetDecimal(item, "highPrice");
                        var lowPrice = GetDecimal(item, "lowPrice");
                        // quoteVolume = 24h USDT volume; volume = base asset volume. We store USDT volume.
                        var volume = GetDecimal(item, "quoteVolume");

                        _cryptoHandler.HandleMiniTicker(symbol, lastPrice, openPrice, highPrice, lowPrice, volume, now);
                        totalCount++;
                    }
                }

                _logger.LogInformation("{ServiceName}: seeded {Count} coins from initial REST snapshot.", ServiceName, totalCount);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{ServiceName}: initial snapshot failed.", ServiceName);
            }
        }

        private static bool IsSubscribeResponse(string message)
        {
            try
            {
                using var doc = JsonDocument.Parse(message);
                return doc.RootElement.TryGetProperty("result", out _) &&
                       doc.RootElement.TryGetProperty("id", out _);
            }
            catch
            {
                return false;
            }
        }

        private static async Task<string?> ReceiveTextMessageAsync(
            ClientWebSocket socket,
            byte[] buffer,
            MemoryStream stream,
            CancellationToken cancellationToken)
        {
            stream.Position = 0;
            stream.SetLength(0);

            while (true)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                    return null;

                if (result.MessageType != WebSocketMessageType.Text)
                {
                    if (result.EndOfMessage)
                    {
                        stream.Position = 0;
                        stream.SetLength(0);
                    }
                    continue;
                }

                stream.Write(buffer, 0, result.Count);

                if (result.EndOfMessage)
                    return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        /// <summary>
        /// Detects and parses Binance !ticker_1h@arr or !ticker_4h@arr messages.
        /// These arrive as: {"stream":"!ticker_1h@arr","data":[{"s":"BTCUSDT","P":"1.23",...},...]}
        /// </summary>
        private static bool TryReadRollingWindowArray(
            string message,
            out int windowHours,
            out RollingWindowFrame[] frames)
        {
            windowHours = 0;
            frames = Array.Empty<RollingWindowFrame>();

            if (string.IsNullOrWhiteSpace(message))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(message);
                var root = doc.RootElement;

                if (root.ValueKind != JsonValueKind.Object)
                    return false;

                if (!root.TryGetProperty("stream", out var streamProp) ||
                    streamProp.ValueKind != JsonValueKind.String)
                    return false;

                var streamName = streamProp.GetString() ?? string.Empty;
                if (streamName.Equals("!ticker_1h@arr", StringComparison.OrdinalIgnoreCase))
                    windowHours = 1;
                else if (streamName.Equals("!ticker_4h@arr", StringComparison.OrdinalIgnoreCase))
                    windowHours = 4;
                else
                    return false;

                if (!root.TryGetProperty("data", out var dataElement) ||
                    dataElement.ValueKind != JsonValueKind.Array)
                    return false;

                var list = new List<RollingWindowFrame>();
                foreach (var item in dataElement.EnumerateArray())
                {
                    var symbol = GetString(item, "s").Trim().ToUpperInvariant();
                    if (string.IsNullOrWhiteSpace(symbol))
                        continue;

                    // "P" = priceChangePercent (string field in rolling ticker)
                    if (!item.TryGetProperty("P", out var pProp))
                        continue;

                    decimal changePercent;
                    if (pProp.ValueKind == JsonValueKind.Number && pProp.TryGetDecimal(out var numeric))
                        changePercent = numeric;
                    else if (pProp.ValueKind == JsonValueKind.String &&
                             decimal.TryParse(pProp.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                        changePercent = parsed;
                    else
                        continue;

                    list.Add(new RollingWindowFrame(symbol, changePercent));
                }

                frames = list.ToArray();
                return frames.Length > 0;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        private static bool TryReadMiniTickerFrame(string message, out MiniTickerFrame frame)
        {
            frame = default;
            if (string.IsNullOrWhiteSpace(message))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(message);
                var root = doc.RootElement;
                var payload = root;

                if (root.ValueKind == JsonValueKind.Object &&
                    root.TryGetProperty("data", out var dataElement) &&
                    dataElement.ValueKind == JsonValueKind.Object)
                {
                    payload = dataElement;
                }

                var symbol = GetString(payload, "s").Trim().ToUpperInvariant();
                var closePrice = GetDecimal(payload, "c");
                var openPrice = GetDecimal(payload, "o");
                var highPrice = GetDecimal(payload, "h");
                var lowPrice = GetDecimal(payload, "l");
                // "q" = quote asset volume (USDT); "v" = base asset volume. We store USDT volume.
                var volume = GetDecimal(payload, "q");
                var eventTimeMs = GetLong(payload, "E");

                if (string.IsNullOrWhiteSpace(symbol) || closePrice <= 0m)
                    return false;

                frame = new MiniTickerFrame(
                    symbol,
                    closePrice,
                    openPrice,
                    highPrice,
                    lowPrice,
                    volume,
                    GetObservedAtUtc(eventTimeMs, DateTime.UtcNow));
                return true;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        private static string GetString(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.String)
                return string.Empty;
            return value.GetString() ?? string.Empty;
        }

        private static decimal GetDecimal(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value))
                return 0m;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var numeric))
                return numeric;

            if (value.ValueKind == JsonValueKind.String &&
                decimal.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                return parsed;

            return 0m;
        }

        private static long GetLong(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value))
                return 0L;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var numeric))
                return numeric;

            if (value.ValueKind == JsonValueKind.String &&
                long.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
                return parsed;

            return 0L;
        }

        private static DateTime GetObservedAtUtc(long unixTimeMs, DateTime fallbackUtc)
        {
            if (unixTimeMs <= 0)
                return fallbackUtc;

            try
            {
                return DateTimeOffset.FromUnixTimeMilliseconds(unixTimeMs).UtcDateTime;
            }
            catch
            {
                return fallbackUtc;
            }
        }

        private TimeSpan GetReconnectDelay(int reconnectAttempt)
        {
            var attempt = Math.Max(1, reconnectAttempt);
            var exponential = (int)Math.Pow(2, attempt - 1);
            var maxSeconds = Math.Max(1, _settings.ReconnectMaxSeconds);
            return TimeSpan.FromSeconds(Math.Min(exponential, maxSeconds));
        }

        private async Task TryCloseSocketAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            if (socket.State != WebSocketState.Open)
                return;

            try
            {
                using var closeCts = cancellationToken.IsCancellationRequested
                    ? new CancellationTokenSource(TimeSpan.FromSeconds(2))
                    : null;

                var closeToken = closeCts?.Token ?? cancellationToken;
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Shutting down", closeToken);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "{ServiceName}: close socket failed.", ServiceName);
            }
        }

        private readonly record struct MiniTickerFrame(
            string Symbol,
            decimal ClosePrice,
            decimal OpenPrice,
            decimal HighPrice,
            decimal LowPrice,
            decimal Volume,
            DateTime ObservedAtUtc);

        private readonly record struct RollingWindowFrame(
            string Symbol,
            decimal PriceChangePercent);
    }
#nullable restore
}
