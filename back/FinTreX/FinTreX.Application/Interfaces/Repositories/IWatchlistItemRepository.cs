using System.Collections.Generic;
using System.Threading.Tasks;
using FinTreX.Core.Entities;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IWatchlistItemRepository : IGenericRepository<WatchlistItem>
    {
        Task<IReadOnlyList<WatchlistItem>> GetByWatchlistIdAsync(int watchlistId);
        Task<WatchlistItem?> GetAsync(int watchlistId, string symbol);
        Task<IReadOnlyList<WatchlistItem>> GetByUserAndSymbolAsync(string userId, string symbol);
        Task<IReadOnlyList<WatchlistItem>> GetAllForUserAsync(string userId);
        Task DeleteRangeAsync(IEnumerable<WatchlistItem> items);
    }
}
