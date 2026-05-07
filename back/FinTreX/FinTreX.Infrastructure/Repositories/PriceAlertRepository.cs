using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace FinTreX.Infrastructure.Repositories
{
    public class PriceAlertRepository : GenericRepository<PriceAlert>, IPriceAlertRepository
    {
        public PriceAlertRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<PriceAlert>> GetByUserIdAsync(
            string userId,
            AlertStatus? status = null,
            string? symbol = null)
        {
            var query = _dbContext.PriceAlerts
                .Where(x => x.ApplicationUserId == userId);

            if (status.HasValue)
            {
                query = query.Where(x => x.Status == status.Value);
            }

            if (!string.IsNullOrWhiteSpace(symbol))
            {
                var normalized = symbol.Trim().ToUpperInvariant();
                query = query.Where(x => x.Symbol == normalized);
            }

            return await query
                .OrderByDescending(x => x.CreatedAtUtc)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<PriceAlert?> GetByIdAndUserAsync(int id, string userId)
        {
            return await _dbContext.PriceAlerts
                .FirstOrDefaultAsync(x => x.Id == id && x.ApplicationUserId == userId);
        }

        public async Task<IReadOnlyList<PriceAlert>> GetActiveByAssetTypeAsync(AssetType assetType)
        {
            return await _dbContext.PriceAlerts
                .Where(x => x.AssetType == assetType && x.Status == AlertStatus.ACTIVE)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<IReadOnlyList<PriceAlert>> GetActiveForSymbolAsync(AssetType assetType, string symbol)
        {
            var normalized = (symbol ?? string.Empty).Trim().ToUpperInvariant();
            return await _dbContext.PriceAlerts
                .Where(x => x.AssetType == assetType &&
                            x.Status == AlertStatus.ACTIVE &&
                            x.Symbol == normalized)
                .AsNoTracking()
                .ToListAsync();
        }
    }
}
