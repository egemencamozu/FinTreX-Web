using System.Collections.Generic;
using System.Threading.Tasks;
using FinTreX.Core.Entities;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IWatchlistRepository : IGenericRepository<Watchlist>
    {
        Task<IReadOnlyList<Watchlist>> GetByUserIdAsync(string userId);
        Task<Watchlist?> GetByIdAndUserAsync(int id, string userId);
        Task<Watchlist?> GetDefaultForUserAsync(string userId);
        Task<bool> ExistsByNameAsync(string userId, string name, int? excludeId = null);
    }
}
