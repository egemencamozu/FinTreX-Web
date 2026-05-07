using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace FinTreX.Infrastructure.Repositories
{
    public class WatchlistRepository : GenericRepository<Watchlist>, IWatchlistRepository
    {
        public WatchlistRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<Watchlist>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.Watchlists
                .Where(x => x.ApplicationUserId == userId)
                .OrderByDescending(x => x.IsDefault)
                .ThenBy(x => x.SortOrder)
                .ThenBy(x => x.CreatedAtUtc)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Watchlist?> GetByIdAndUserAsync(int id, string userId)
        {
            return await _dbContext.Watchlists
                .FirstOrDefaultAsync(x => x.Id == id && x.ApplicationUserId == userId);
        }

        public async Task<Watchlist?> GetDefaultForUserAsync(string userId)
        {
            return await _dbContext.Watchlists
                .FirstOrDefaultAsync(x => x.ApplicationUserId == userId && x.IsDefault);
        }

        public async Task<bool> ExistsByNameAsync(string userId, string name, int? excludeId = null)
        {
            var query = _dbContext.Watchlists
                .Where(x => x.ApplicationUserId == userId && x.Name == name);

            if (excludeId.HasValue)
            {
                query = query.Where(x => x.Id != excludeId.Value);
            }

            return await query.AnyAsync();
        }
    }
}
