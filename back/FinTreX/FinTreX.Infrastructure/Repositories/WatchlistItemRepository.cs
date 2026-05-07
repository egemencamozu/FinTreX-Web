using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace FinTreX.Infrastructure.Repositories
{
    public class WatchlistItemRepository : GenericRepository<WatchlistItem>, IWatchlistItemRepository
    {
        public WatchlistItemRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<WatchlistItem>> GetByWatchlistIdAsync(int watchlistId)
        {
            return await _dbContext.WatchlistItems
                .Where(x => x.WatchlistId == watchlistId)
                .OrderByDescending(x => x.AddedAtUtc)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<WatchlistItem?> GetAsync(int watchlistId, string symbol)
        {
            var normalized = (symbol ?? string.Empty).Trim().ToUpperInvariant();
            return await _dbContext.WatchlistItems
                .FirstOrDefaultAsync(x => x.WatchlistId == watchlistId && x.Symbol == normalized);
        }

        public async Task<IReadOnlyList<WatchlistItem>> GetByUserAndSymbolAsync(string userId, string symbol)
        {
            var normalized = (symbol ?? string.Empty).Trim().ToUpperInvariant();
            return await _dbContext.WatchlistItems
                .Where(x => x.Symbol == normalized &&
                            x.Watchlist.ApplicationUserId == userId)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<IReadOnlyList<WatchlistItem>> GetAllForUserAsync(string userId)
        {
            return await _dbContext.WatchlistItems
                .Where(x => x.Watchlist.ApplicationUserId == userId)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task DeleteRangeAsync(IEnumerable<WatchlistItem> items)
        {
            _dbContext.WatchlistItems.RemoveRange(items);
            await _dbContext.SaveChangesAsync();
        }
    }
}
