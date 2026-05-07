using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

#nullable enable
namespace FinTreX.Infrastructure.Services.MarketData
{
    /// <summary>
    /// Aktif <see cref="PriceAlert"/> kayıtlarını periyodik olarak tarar ve
    /// market cache'ten alınan son fiyatlarla karşılaştırır. Koşul sağlandığında
    /// <see cref="IAlertsBroadcaster"/> üzerinden kullanıcıya canlı push atar,
    /// gerekirse e-posta gönderir ve alarm durumunu günceller.
    /// </summary>
    public sealed class AlertEvaluationService : BackgroundService
    {
        private static readonly TimeSpan EvaluationInterval = TimeSpan.FromSeconds(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMarketDataCache _marketDataCache;
        private readonly ILogger<AlertEvaluationService> _logger;

        public AlertEvaluationService(
            IServiceScopeFactory scopeFactory,
            IMarketDataCache marketDataCache,
            ILogger<AlertEvaluationService> logger)
        {
            _scopeFactory = scopeFactory;
            _marketDataCache = marketDataCache;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AlertEvaluationService started. Interval={Interval}", EvaluationInterval);

            using var timer = new PeriodicTimer(EvaluationInterval);

            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    try
                    {
                        await EvaluateOnceAsync(stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Alert evaluation tick failed.");
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown
            }
        }

        private async Task EvaluateOnceAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var alertRepo = scope.ServiceProvider.GetRequiredService<IPriceAlertRepository>();
            var broadcaster = scope.ServiceProvider.GetService<IAlertsBroadcaster>();
            var emailService = scope.ServiceProvider.GetService<IMailKitEmailService>();

            foreach (var assetType in new[] { AssetType.BIST, AssetType.Crypto, AssetType.PreciousMetal })
            {
                if (ct.IsCancellationRequested) return;

                var alerts = await alertRepo.GetActiveByAssetTypeAsync(assetType);
                if (alerts.Count == 0) continue;

                foreach (var alert in alerts)
                {
                    if (ct.IsCancellationRequested) return;

                    var currentPrice = ResolveCurrentPrice(alert);
                    if (currentPrice is null || currentPrice.Value <= 0m) continue;

                    if (!IsTriggered(alert, currentPrice.Value)) continue;

                    _logger.LogInformation(
                        "Alert {AlertId} triggered. Symbol={Symbol} Channels={Channels}({ChannelsInt}) EmailService={HasEmail}",
                        alert.Id, alert.Symbol, alert.Channels, (int)alert.Channels, emailService is not null);

                    await HandleTriggeredAsync(alertRepo, broadcaster, emailService, alert, currentPrice.Value);
                }
            }
        }

        private async Task HandleTriggeredAsync(
            IPriceAlertRepository alertRepo,
            IAlertsBroadcaster? broadcaster,
            IMailKitEmailService? emailService,
            PriceAlert alert,
            decimal currentPrice)
        {
            alert.TriggerCount += 1;
            alert.TriggeredAtUtc = DateTime.UtcNow;
            alert.TriggeredPrice = currentPrice;
            alert.UpdatedAtUtc = DateTime.UtcNow;

            // Repeat davranışı
            bool deleteAfter = false;
            switch (alert.Repeat)
            {
                case AlertRepeat.ONCE:
                    alert.Status = AlertStatus.TRIGGERED;
                    break;

                case AlertRepeat.AUTO_DELETE:
                    deleteAfter = true;
                    break;

                case AlertRepeat.RECURRING:
                    // Aktif kalır — ancak hemen tekrar tetiklenmesini önlemek için
                    // PRICE modunda hedef yönünü ters çeviriyor olabiliriz. Şimdilik
                    // küçük bir cooldown uygulamak için status'u ACTIVE bırakıp
                    // TriggeredAtUtc'yi güncelliyoruz; kısa vadeli flapping için
                    // minimum aralık eklenebilir.
                    alert.Status = AlertStatus.ACTIVE;
                    break;
            }

            try
            {
                if (deleteAfter)
                {
                    await alertRepo.DeleteAsync(alert);
                }
                else
                {
                    await alertRepo.UpdateAsync(alert);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist triggered alert {AlertId}", alert.Id);
            }

            var payload = new AlertTriggerEventDto
            {
                AlertId = alert.Id,
                Symbol = alert.Symbol,
                AssetName = alert.AssetName,
                TriggeredPrice = currentPrice,
                TargetValue = alert.TargetValue,
                Kind = alert.Kind.ToString(),
                Direction = alert.Direction.ToString(),
                TriggeredAtUtc = alert.TriggeredAtUtc ?? DateTime.UtcNow,
            };

            // 1) SignalR push (IN_APP)
            if (broadcaster is not null && alert.Channels.HasFlag(AlertChannel.IN_APP))
            {
                await broadcaster.PushAlertTriggeredAsync(alert.ApplicationUserId, payload);
            }

            // 2) E-posta
            if (emailService is not null && alert.Channels.HasFlag(AlertChannel.EMAIL))
            {
                await TrySendEmailAsync(emailService, alert, currentPrice);
            }
        }

        private async Task TrySendEmailAsync(IMailKitEmailService emailService, PriceAlert alert, decimal currentPrice)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                // Background context'te ICurrentUserService olmadığı için kullanıcıyı
                // doğrudan Identity store'undan (UserManager) çekiyoruz.
                var userManager = scope.ServiceProvider
                    .GetService<Microsoft.AspNetCore.Identity.UserManager<FinTreX.Infrastructure.Models.ApplicationUser>>();

                if (userManager is null) return;

                var user = await userManager.FindByIdAsync(alert.ApplicationUserId);
                if (user is null || string.IsNullOrWhiteSpace(user.Email)) return;

                var subject = $"Alarm tetiklendi: {alert.Symbol}";
                var directionLabel = alert.Direction == AlertDirection.ABOVE ? "üzerine çıktı" : "altına indi";
                var body = alert.Kind == AlertKind.PRICE
                    ? $"<p><strong>{alert.Symbol}</strong> fiyatı <strong>{alert.TargetValue}</strong> hedefinin {directionLabel}.</p>" +
                      $"<p>Güncel fiyat: <strong>{currentPrice}</strong></p>"
                    : $"<p><strong>{alert.Symbol}</strong> baz fiyata göre yüzde hedefiniz tetiklendi.</p>" +
                      $"<p>Baz: {alert.BaselinePrice} — Güncel: <strong>{currentPrice}</strong></p>";

                await emailService.SendAsync(user.Email, subject, body);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send alert email for alert {AlertId}", alert.Id);
            }
        }

        private static bool IsTriggered(PriceAlert alert, decimal currentPrice)
        {
            if (alert.Kind == AlertKind.PRICE)
            {
                return alert.Direction switch
                {
                    AlertDirection.ABOVE => currentPrice >= alert.TargetValue,
                    AlertDirection.BELOW => currentPrice <= alert.TargetValue,
                    _ => false,
                };
            }

            // PERCENT
            var baseline = alert.BaselinePrice ?? 0m;
            if (baseline <= 0m) return false;

            var changePct = ((currentPrice - baseline) / baseline) * 100m;

            return alert.Direction switch
            {
                AlertDirection.ABOVE => changePct >= alert.TargetValue,
                AlertDirection.BELOW => changePct <= -Math.Abs(alert.TargetValue),
                _ => false,
            };
        }

        private decimal? ResolveCurrentPrice(PriceAlert alert)
        {
            try
            {
                switch (alert.AssetType)
                {
                    case AssetType.Crypto:
                        {
                            var key = alert.Symbol.EndsWith("USDT", StringComparison.OrdinalIgnoreCase)
                                ? alert.Symbol
                                : alert.Symbol + "USDT";
                            var crypto = _marketDataCache.GetCrypto(key);
                            if (crypto is not null)
                            {
                                if (string.Equals(alert.Currency, "TRY", StringComparison.OrdinalIgnoreCase) && crypto.PriceTry > 0m)
                                    return crypto.PriceTry;
                                if (crypto.PriceUsdt > 0m) return crypto.PriceUsdt;
                            }
                            break;
                        }
                    case AssetType.BIST:
                        {
                            var ticker = alert.Symbol.EndsWith(".IS", StringComparison.OrdinalIgnoreCase)
                                ? alert.Symbol
                                : alert.Symbol + ".IS";
                            var stock = _marketDataCache.GetStock(ticker);
                            if (stock is not null && stock.Price > 0m) return stock.Price;
                            break;
                        }
                    case AssetType.PreciousMetal:
                        {
                            var gold = _marketDataCache.GetGold(alert.Symbol);
                            if (gold is not null)
                            {
                                if (string.Equals(alert.Currency, "TRY", StringComparison.OrdinalIgnoreCase) && gold.GramTry > 0m)
                                    return gold.GramTry;
                                if (gold.GramUsd > 0m) return gold.GramUsd;
                            }
                            break;
                        }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Could not resolve price for alert {AlertId} ({Symbol})", alert.Id, alert.Symbol);
            }

            return null;
        }
    }
}
