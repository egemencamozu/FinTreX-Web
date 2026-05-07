using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.Watchlist;
using FinTreX.Core.Entities;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

#nullable enable
namespace FinTreX.Core.Services
{
    /// <summary>
    /// Kullanıcının birden çok "izleme listesi" (watchlist) oluşturup sembolleri
    /// organize etmesine olanak tanır. Yeni kullanıcı için ilk istekte otomatik
    /// bir "Ana Liste" (IsDefault = true) oluşturulur.
    /// </summary>
    public class WatchlistService : IWatchlistService
    {
        private const string DefaultListName = "Ana Liste";

        private readonly IWatchlistRepository _watchlistRepo;
        private readonly IWatchlistItemRepository _itemRepo;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<WatchlistService> _logger;

        public WatchlistService(
            IWatchlistRepository watchlistRepo,
            IWatchlistItemRepository itemRepo,
            ICurrentUserService currentUserService,
            ILogger<WatchlistService> logger)
        {
            _watchlistRepo = watchlistRepo;
            _itemRepo = itemRepo;
            _currentUserService = currentUserService;
            _logger = logger;
        }

        public async Task<IReadOnlyList<WatchlistDto>> GetMyWatchlistsAsync()
        {
            var userId = RequireUser();
            await EnsureDefaultWatchlistAsync(userId);

            var lists = await _watchlistRepo.GetByUserIdAsync(userId);
            var counts = (await _itemRepo.GetAllForUserAsync(userId))
                .GroupBy(x => x.WatchlistId)
                .ToDictionary(g => g.Key, g => g.Count());

            return lists.Select(l => MapToDto(l, counts.GetValueOrDefault(l.Id, 0))).ToList().AsReadOnly();
        }

        public async Task<WatchlistDto> GetByIdAsync(int id)
        {
            var userId = RequireUser();
            var list = await _watchlistRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Watchlist not found.");
            var count = (await _itemRepo.GetByWatchlistIdAsync(list.Id)).Count;
            return MapToDto(list, count);
        }

        public async Task<WatchlistDto> CreateAsync(CreateWatchlistRequest request)
        {
            var userId = RequireUser();
            var name = (request.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ApiException("Liste adı boş olamaz.");
            }

            if (await _watchlistRepo.ExistsByNameAsync(userId, name))
            {
                throw new ConflictException("Bu isimde bir listeniz zaten var.");
            }

            var entity = new Watchlist
            {
                ApplicationUserId = userId,
                Name = name,
                Color = request.Color,
                SortOrder = 0,
                IsDefault = false,
                CreatedAtUtc = DateTime.UtcNow,
            };

            await _watchlistRepo.AddAsync(entity);
            return MapToDto(entity, 0);
        }

        public async Task<WatchlistDto> UpdateAsync(int id, UpdateWatchlistRequest request)
        {
            var userId = RequireUser();
            var entity = await _watchlistRepo.GetByIdAndUserAsync(id, userId)
                ?? throw new KeyNotFoundException("Watchlist not found.");

            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                var newName = request.Name.Trim();
                if (!string.Equals(newName, entity.Name, StringComparison.Ordinal) &&
                    await _watchlistRepo.ExistsByNameAsync(userId, newName, excludeId: id))
                {
                    throw new ConflictException("Bu isimde bir listeniz zaten var.");
                }
                entity.Name = newName;
            }

            if (request.Color is not null)
            {
                entity.Color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim();
            }

            if (request.SortOrder.HasValue)
            {
                entity.SortOrder = request.SortOrder.Value;
            }

            entity.UpdatedAtUtc = DateTime.UtcNow;
            await _watchlistRepo.UpdateAsync(entity);

            var count = (await _itemRepo.GetByWatchlistIdAsync(entity.Id)).Count;
            return MapToDto(entity, count);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var userId = RequireUser();
            var entity = await _watchlistRepo.GetByIdAndUserAsync(id, userId);
            if (entity is null) return false;

            if (entity.IsDefault)
            {
                throw new ApiException("Varsayılan liste silinemez.");
            }

            await _watchlistRepo.DeleteAsync(entity);
            return true;
        }

        public async Task<IReadOnlyList<WatchlistItemDto>> GetItemsAsync(int watchlistId)
        {
            var userId = RequireUser();
            var list = await _watchlistRepo.GetByIdAndUserAsync(watchlistId, userId)
                ?? throw new KeyNotFoundException("Watchlist not found.");

            var items = await _itemRepo.GetByWatchlistIdAsync(list.Id);
            return items.Select(MapItemToDto).ToList().AsReadOnly();
        }

        public async Task<WatchlistItemDto> AddItemAsync(int watchlistId, AddWatchlistItemRequest request)
        {
            var userId = RequireUser();
            var list = await _watchlistRepo.GetByIdAndUserAsync(watchlistId, userId)
                ?? throw new KeyNotFoundException("Watchlist not found.");

            var symbol = NormalizeSymbol(request.Symbol);

            var existing = await _itemRepo.GetAsync(list.Id, symbol);
            if (existing is not null)
            {
                // Idempotent: return the existing record without throwing.
                return MapItemToDto(existing);
            }

            var entity = new WatchlistItem
            {
                WatchlistId = list.Id,
                Symbol = symbol,
                AssetType = request.AssetType,
                AssetName = request.AssetName?.Trim(),
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                AddedAtUtc = DateTime.UtcNow,
            };

            await _itemRepo.AddAsync(entity);
            return MapItemToDto(entity);
        }

        public async Task<bool> RemoveItemAsync(int watchlistId, int itemId)
        {
            var userId = RequireUser();
            var list = await _watchlistRepo.GetByIdAndUserAsync(watchlistId, userId);
            if (list is null) return false;

            var item = await _itemRepo.GetByIdAsync(itemId);
            if (item is null || item.WatchlistId != list.Id) return false;

            await _itemRepo.DeleteAsync(item);
            return true;
        }

        public async Task<ToggleSymbolResponse> ToggleSymbolAsync(ToggleSymbolRequest request)
        {
            var userId = RequireUser();
            var symbol = NormalizeSymbol(request.Symbol);

            var userLists = await _watchlistRepo.GetByUserIdAsync(userId);
            var userListIds = userLists.Select(x => x.Id).ToHashSet();

            // Sadece kullanıcıya ait olan list id'lerini kabul et.
            var targetIds = (request.WatchlistIds ?? new List<int>())
                .Where(id => userListIds.Contains(id))
                .Distinct()
                .ToHashSet();

            var existingItems = await _itemRepo.GetByUserAndSymbolAsync(userId, symbol);
            var existingByListId = existingItems.ToDictionary(x => x.WatchlistId, x => x);

            // Listeden çıkarılacak olanlar
            var toRemove = existingItems.Where(x => !targetIds.Contains(x.WatchlistId)).ToList();
            if (toRemove.Count > 0)
            {
                await _itemRepo.DeleteRangeAsync(toRemove);
            }

            // Eklenmesi gerekenler
            foreach (var listId in targetIds)
            {
                if (existingByListId.ContainsKey(listId)) continue;

                var item = new WatchlistItem
                {
                    WatchlistId = listId,
                    Symbol = symbol,
                    AssetType = request.AssetType,
                    AssetName = request.AssetName?.Trim(),
                    AddedAtUtc = DateTime.UtcNow,
                };
                await _itemRepo.AddAsync(item);
            }

            return new ToggleSymbolResponse
            {
                Symbol = symbol,
                WatchlistIds = targetIds.OrderBy(x => x).ToList(),
            };
        }

        public async Task<IReadOnlyList<string>> GetAllFavoriteSymbolsAsync()
        {
            var userId = RequireUser();
            var items = await _itemRepo.GetAllForUserAsync(userId);
            return items
                .Select(x => x.Symbol)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
                .AsReadOnly();
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

        private async Task EnsureDefaultWatchlistAsync(string userId)
        {
            var hasAny = (await _watchlistRepo.GetByUserIdAsync(userId)).Count > 0;
            if (hasAny) return;

            try
            {
                var defaultList = new Watchlist
                {
                    ApplicationUserId = userId,
                    Name = DefaultListName,
                    IsDefault = true,
                    SortOrder = 0,
                    CreatedAtUtc = DateTime.UtcNow,
                };
                await _watchlistRepo.AddAsync(defaultList);
            }
            catch (Exception ex)
            {
                // Paralel istek yarışı unique index ihlaline yol açarsa sessizce geç.
                _logger.LogWarning(ex, "Failed to seed default watchlist for user {UserId}", userId);
            }
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

        private static WatchlistDto MapToDto(Watchlist w, int itemCount) => new()
        {
            Id = w.Id,
            Name = w.Name,
            Color = w.Color,
            SortOrder = w.SortOrder,
            IsDefault = w.IsDefault,
            ItemCount = itemCount,
            CreatedAtUtc = w.CreatedAtUtc,
            UpdatedAtUtc = w.UpdatedAtUtc,
        };

        private static WatchlistItemDto MapItemToDto(WatchlistItem i) => new()
        {
            Id = i.Id,
            WatchlistId = i.WatchlistId,
            Symbol = i.Symbol,
            AssetType = i.AssetType,
            AssetName = i.AssetName,
            Note = i.Note,
            AddedAtUtc = i.AddedAtUtc,
        };
    }
}
