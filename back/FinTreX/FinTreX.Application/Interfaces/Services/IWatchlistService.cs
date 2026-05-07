using System.Collections.Generic;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.Watchlist;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IWatchlistService
    {
        Task<IReadOnlyList<WatchlistDto>> GetMyWatchlistsAsync();
        Task<WatchlistDto> GetByIdAsync(int id);
        Task<WatchlistDto> CreateAsync(CreateWatchlistRequest request);
        Task<WatchlistDto> UpdateAsync(int id, UpdateWatchlistRequest request);
        Task<bool> DeleteAsync(int id);

        Task<IReadOnlyList<WatchlistItemDto>> GetItemsAsync(int watchlistId);
        Task<WatchlistItemDto> AddItemAsync(int watchlistId, AddWatchlistItemRequest request);
        Task<bool> RemoveItemAsync(int watchlistId, int itemId);

        Task<ToggleSymbolResponse> ToggleSymbolAsync(ToggleSymbolRequest request);

        /// <summary>
        /// Kullanıcının herhangi bir watchlist'inde bulunan tüm benzersiz sembol listesini döner.
        /// Frontend'de "favori mi?" kontrolü için.
        /// </summary>
        Task<IReadOnlyList<string>> GetAllFavoriteSymbolsAsync();
    }
}
