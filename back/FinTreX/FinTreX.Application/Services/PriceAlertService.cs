using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

#nullable enable
namespace FinTreX.Core.Services
{
    /// <summary>
    /// Kullanıcıya ait fiyat / yüzde alarmlarını yönetir. Tetikleme işi
    /// <c>AlertEvaluationService</c>'e bırakılır.
    /// </summary>
    public class PriceAlertService : IPriceAlertService
    {
        private readonly IPriceAlertRepository _alertRepo;
        private readonly IWatchlistRepository _watchlistRepo;
        private readonly ICurrentUserService _currentUserService;
        private readonly IMarketDataCache _marketDataCache;
        private readonly ILogger<PriceAlertService> _logger;

        public PriceAlertService(
            IPriceAlertRepository alertRepo,
            IWatchlistRepository watchlistRepo,
            ICurrentUserService currentUserService,
            IMarketDataCache marketDataCache,
            ILogger<PriceAlertService> logger)
        {
            _alertRepo = alertRepo;
            _watchlistRepo = watchlistRepo;
            _currentUserService = currentUserService;
            _marketDataCache = marketDataCache;
            _logger = logger;
        }

        public async Task<IReadOnlyList<PriceAlertDto>> GetMyAlertsAsync(AlertStatus? status = null, string? symbol = null)
        {
            var userId = RequireUser();
            var alerts = await _alertRepo.GetByUserIdAsync(userId, status, symbol);
            return alerts.Select(MapToDto).ToList().AsReadOnly();
        }

        public async Task<PriceAlertDto> GetByIdAsync(int id)
        {
            var userId = RequireUser();
            var alert = await _alertRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Alert not found.");
            return MapToDto(alert);
        }

        public async Task<PriceAlertDto> CreateAsync(CreatePriceAlertRequest request)
        {
            var userId = RequireUser();

            if (request.TargetValue <= 0m)
            {
                throw new ApiException("Hedef değer 0'dan büyük olmalıdır.");
            }

            if (request.WatchlistId.HasValue)
            {
                var list = await _watchlistRepo.GetByIdAndUserAsync(request.WatchlistId.Value, userId);
                if (list is null)
                {
                    throw new ApiException("Seçilen izleme listesi bulunamadı.");
                }
            }

            var symbol = NormalizeSymbol(request.Symbol);
            var channels = ParseChannels(request.Channels);
            if (channels == AlertChannel.None)
            {
                channels = AlertChannel.IN_APP;
            }

            // PERCENT alarm için baseline zorunlu; istemci göndermediyse snapshot al.
            decimal? baseline = request.BaselinePrice;
            if (request.Kind == AlertKind.PERCENT && (!baseline.HasValue || baseline.Value <= 0m))
            {
                var livePrice = ResolveCurrentPrice(request.AssetType, symbol);
                if (livePrice is null || livePrice.Value <= 0m)
                {
                    throw new ApiException("Yüzde alarmı için güncel fiyat alınamadı; lütfen sonra tekrar deneyin.");
                }
                baseline = livePrice;
            }

            var entity = new PriceAlert
            {
                ApplicationUserId = userId,
                Symbol = symbol,
                AssetType = request.AssetType,
                AssetName = request.AssetName?.Trim(),
                Kind = request.Kind,
                Direction = request.Direction,
                TargetValue = request.TargetValue,
                BaselinePrice = baseline,
                Currency = string.IsNullOrWhiteSpace(request.Currency) ? "TRY" : request.Currency!.Trim().ToUpperInvariant(),
                Repeat = request.Repeat,
                Channels = channels,
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note!.Trim(),
                WatchlistId = request.WatchlistId,
                Status = AlertStatus.ACTIVE,
                CreatedAtUtc = DateTime.UtcNow,
            };

            await _alertRepo.AddAsync(entity);
            return MapToDto(entity);
        }

        public async Task<PriceAlertDto> UpdateAsync(int id, UpdatePriceAlertRequest request)
        {
            var userId = RequireUser();
            var entity = await _alertRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Alert not found.");

            if (request.Kind.HasValue) entity.Kind = request.Kind.Value;
            if (request.Direction.HasValue) entity.Direction = request.Direction.Value;
            if (request.TargetValue.HasValue)
            {
                if (request.TargetValue.Value <= 0m) throw new ApiException("Hedef değer 0'dan büyük olmalıdır.");
                entity.TargetValue = request.TargetValue.Value;
            }
            if (request.BaselinePrice.HasValue) entity.BaselinePrice = request.BaselinePrice.Value;
            if (request.Repeat.HasValue) entity.Repeat = request.Repeat.Value;

            if (request.Channels is not null)
            {
                var channels = ParseChannels(request.Channels);
                entity.Channels = channels == AlertChannel.None ? AlertChannel.IN_APP : channels;
            }

            if (request.Note is not null)
            {
                entity.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            }

            if (request.WatchlistId.HasValue)
            {
                var list = await _watchlistRepo.GetByIdAndUserAsync(request.WatchlistId.Value, userId);
                if (list is null) throw new ApiException("Seçilen izleme listesi bulunamadı.");
                entity.WatchlistId = request.WatchlistId.Value;
            }

            entity.UpdatedAtUtc = DateTime.UtcNow;
            await _alertRepo.UpdateAsync(entity);
            return MapToDto(entity);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var userId = RequireUser();
            var entity = await _alertRepo.GetByIdAndUserAsync(id, userId);
            if (entity is null) return false;
            await _alertRepo.DeleteAsync(entity);
            return true;
        }

        public async Task<PriceAlertDto> PauseAsync(int id)
        {
            var userId = RequireUser();
            var entity = await _alertRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Alert not found.");
            entity.Status = AlertStatus.PAUSED;
            entity.UpdatedAtUtc = DateTime.UtcNow;
            await _alertRepo.UpdateAsync(entity);
            return MapToDto(entity);
        }

        public async Task<PriceAlertDto> ResumeAsync(int id)
        {
            var userId = RequireUser();
            var entity = await _alertRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Alert not found.");
            entity.Status = AlertStatus.ACTIVE;
            entity.TriggeredAtUtc = null;
            entity.TriggeredPrice = null;
            entity.UpdatedAtUtc = DateTime.UtcNow;
            await _alertRepo.UpdateAsync(entity);
            return MapToDto(entity);
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private string RequireUser()
        {
            var userId = _currentUserService.UserId;
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ForbiddenException("Authenticated user required.");
            }
            return userId;
        }

        private decimal? ResolveCurrentPrice(AssetType assetType, string symbol)
        {
            try
            {
                switch (assetType)
                {
                    case AssetType.Crypto:
                        {
                            var key = symbol.EndsWith("USDT", StringComparison.OrdinalIgnoreCase)
                                ? symbol
                                : symbol + "USDT";
                            var crypto = _marketDataCache.GetCrypto(key);
                            if (crypto is not null && crypto.PriceUsdt > 0m) return crypto.PriceUsdt;
                            break;
                        }
                    case AssetType.BIST:
                        {
                            var ticker = symbol.EndsWith(".IS", StringComparison.OrdinalIgnoreCase)
                                ? symbol
                                : symbol + ".IS";
                            var stock = _marketDataCache.GetStock(ticker);
                            if (stock is not null && stock.Price > 0m) return stock.Price;
                            break;
                        }
                    case AssetType.PreciousMetal:
                        {
                            var gold = _marketDataCache.GetGold(symbol);
                            if (gold is not null && gold.GramTry > 0m) return gold.GramTry;
                            break;
                        }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve current price for {Symbol} ({AssetType})", symbol, assetType);
            }

            return null;
        }

        private static string NormalizeSymbol(string symbol)
        {
            var trimmed = (symbol ?? string.Empty).Trim().ToUpperInvariant();
            if (trimmed.Length == 0)
            {
                throw new ApiException("Sembol boş olamaz.");
            }
            return trimmed;
        }

        private static AlertChannel ParseChannels(List<string>? channels)
        {
            if (channels is null || channels.Count == 0)
            {
                return AlertChannel.None;
            }

            var result = AlertChannel.None;
            foreach (var raw in channels)
            {
                if (string.IsNullOrWhiteSpace(raw)) continue;
                var normalized = raw.Trim().ToUpperInvariant().Replace("-", "_");
                if (normalized == "IN_APP" || normalized == "INAPP" || normalized == "APP")
                {
                    result |= AlertChannel.IN_APP;
                }
                else if (normalized == "EMAIL" || normalized == "MAIL")
                {
                    result |= AlertChannel.EMAIL;
                }
            }
            return result;
        }

        internal static List<string> SerializeChannels(AlertChannel channels)
        {
            var list = new List<string>();
            if (channels.HasFlag(AlertChannel.IN_APP)) list.Add("IN_APP");
            if (channels.HasFlag(AlertChannel.EMAIL)) list.Add("EMAIL");
            return list;
        }

        internal static PriceAlertDto MapToDto(PriceAlert a) => new()
        {
            Id = a.Id,
            Symbol = a.Symbol,
            AssetType = a.AssetType,
            AssetName = a.AssetName,
            Kind = a.Kind,
            Direction = a.Direction,
            TargetValue = a.TargetValue,
            BaselinePrice = a.BaselinePrice,
            Currency = a.Currency,
            Repeat = a.Repeat,
            Channels = SerializeChannels(a.Channels),
            Note = a.Note,
            WatchlistId = a.WatchlistId,
            Status = a.Status,
            CreatedAtUtc = a.CreatedAtUtc,
            UpdatedAtUtc = a.UpdatedAtUtc,
            TriggeredAtUtc = a.TriggeredAtUtc,
            TriggeredPrice = a.TriggeredPrice,
            TriggerCount = a.TriggerCount,
        };
    }
}
