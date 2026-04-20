using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Proto;
using FinTreX.Infrastructure.Services.MarketData.Decode;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Buffers;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.WebSocket
{
#nullable enable
    /// <summary>
    /// Base Yahoo stream worker:
    /// - manages websocket connect/reconnect
    /// - sends subscribe payload
    /// - decodes inbound messages to PricingData
    /// - delegates routing to derived services
    /// </summary>
    public abstract class YahooWebSocketBase : BackgroundService
    {
        private readonly IYahooPricingDecoder _decoder;
        private readonly MarketDataSettings _settings;
        private readonly ILogger _logger;

        protected YahooWebSocketBase(
            IYahooPricingDecoder decoder,
            IOptions<MarketDataSettings> settings,
            ILogger logger)
        {
            _decoder = decoder;
            _settings = settings.Value;
            _logger = logger;
        }

        protected MarketDataSettings Settings => _settings;
        protected ILogger Logger => _logger;

        protected abstract string ServiceName { get; }

        protected abstract IReadOnlyCollection<string> GetSubscribeSymbols();

        protected abstract Task<bool> CanConnectAsync(CancellationToken cancellationToken);

        protected virtual Task OnIdleAsync(CancellationToken cancellationToken) =>
            Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);

        /// <summary>
        /// Returns receive timeout seconds for socket reads.
        /// Return null/0/negative to disable timeout (derived services can override).
        /// </summary>
        protected virtual int? GetReceiveTimeoutSeconds() => _settings.SessionTimeoutSeconds;

        protected abstract Task HandlePricingDataAsync(PricingData data, CancellationToken cancellationToken);

        /// <summary>
        /// Optional hook for derived services to send additional subscribe messages
        /// over the active socket while the receive loop is running.
        /// Runs concurrently with ReceiveLoopAsync. Default: no-op.
        /// </summary>
        protected virtual Task OnRuntimeSubscribeAsync(ClientWebSocket socket, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var reconnectAttempt = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                if (!await CanConnectAsync(stoppingToken))
                {
                    reconnectAttempt = 0;
                    await OnIdleAsync(stoppingToken);
                    continue;
                }

                using var socket = new ClientWebSocket();

                try
                {
                    await ConnectAsync(socket, stoppingToken);
                    reconnectAttempt = 0;

                    await SubscribeAsync(socket, stoppingToken);

                    using var loopCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    var receiveTask = ReceiveLoopAsync(socket, loopCts.Token);
                    var runtimeSubscribeTask = OnRuntimeSubscribeAsync(socket, loopCts.Token);

                    // When receive loop ends (normally or with exception), always cancel
                    // and await the subscribe task so it never runs against a closed socket.
                    try
                    {
                        await receiveTask;
                    }
                    finally
                    {
                        loopCts.Cancel();
                        await runtimeSubscribeTask.ConfigureAwait(false);
                    }
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
                        ServiceName,
                        reconnectAttempt,
                        (int)delay.TotalSeconds);

                    await Task.Delay(delay, stoppingToken);
                }
                finally
                {
                    await TryCloseSocketAsync(socket, stoppingToken);
                }
            }
        }

        private async Task ConnectAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var uri = new Uri(_settings.YahooWebSocketUrl);
            _logger.LogInformation("{ServiceName}: connecting to {Url}", ServiceName, uri);

            await socket.ConnectAsync(uri, cancellationToken);

            _logger.LogInformation("{ServiceName}: connected", ServiceName);
        }

        private async Task SubscribeAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var symbols = GetSubscribeSymbols()
                .Where(symbol => !string.IsNullOrWhiteSpace(symbol))
                .Select(symbol => symbol.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (symbols.Length == 0)
            {
                _logger.LogWarning("{ServiceName}: no symbols to subscribe.", ServiceName);
                return;
            }

            var chunkSize = Math.Max(1, _settings.YahooSubscribeChunkSize);
            var totalChunks = (symbols.Length + chunkSize - 1) / chunkSize;
            var chunkNumber = 0;

            foreach (var chunk in symbols.Chunk(chunkSize))
            {
                chunkNumber++;

                var payload = JsonSerializer.Serialize(new { subscribe = chunk });
                var bytes = Encoding.UTF8.GetBytes(payload);
                var segment = new ArraySegment<byte>(bytes);

                await socket.SendAsync(segment, WebSocketMessageType.Text, endOfMessage: true, cancellationToken);

                _logger.LogInformation(
                    "{ServiceName}: subscribed chunk {ChunkNumber}/{TotalChunks} with {ChunkSize} symbols",
                    ServiceName,
                    chunkNumber,
                    totalChunks,
                    chunk.Length);
            }

            _logger.LogInformation("{ServiceName}: subscribed to {Count} symbols", ServiceName, symbols.Length);
        }

        private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var buffer = ArrayPool<byte>.Shared.Rent(8 * 1024);
            try
            {
                using var messageStream = new MemoryStream(8 * 1024);
                while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
                {
                    string? message;
                    var timeoutSeconds = GetReceiveTimeoutSeconds();

                    if (timeoutSeconds is > 0)
                    {
                        using var receiveCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                        receiveCts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds.Value));

                        try
                        {
                            message = await ReceiveTextMessageAsync(socket, buffer, messageStream, receiveCts.Token);
                        }
                        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && receiveCts.IsCancellationRequested)
                        {
                            throw new TimeoutException($"{ServiceName}: receive timeout ({timeoutSeconds.Value}s).");
                        }
                    }
                    else
                    {
                        message = await ReceiveTextMessageAsync(socket, buffer, messageStream, cancellationToken);
                    }

                    if (message is null)
                    {
                        _logger.LogWarning("{ServiceName}: websocket closed by remote host.", ServiceName);
                        break;
                    }

                    if (!_decoder.TryDecode(message, out var pricingData))
                    {
                        continue;
                    }

                    await HandlePricingDataAsync(pricingData, cancellationToken);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
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
                {
                    return null;
                }

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
                {
                    return Encoding.UTF8.GetString(stream.ToArray());
                }
            }
        }

        private TimeSpan GetReconnectDelay(int reconnectAttempt)
        {
            var attempt = Math.Max(1, reconnectAttempt);
            var exponential = (int)Math.Pow(2, attempt - 1);
            var maxSeconds = Math.Max(1, _settings.ReconnectMaxSeconds);
            var delaySeconds = Math.Min(exponential, maxSeconds);

            return TimeSpan.FromSeconds(delaySeconds);
        }

        private async Task TryCloseSocketAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            if (socket.State != WebSocketState.Open)
            {
                return;
            }

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
    }
#nullable restore
}
