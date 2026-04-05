using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class PortfolioAssetRepository : GenericRepository<PortfolioAsset>, IPortfolioAssetRepository
    {
        public PortfolioAssetRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<PortfolioAsset>> GetByPortfolioIdAsync(int portfolioId)
        {
            return await _dbContext.PortfolioAssets
                .Where(x => x.PortfolioId == portfolioId)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<PortfolioAsset>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.PortfolioAssets
                .Include(x => x.Portfolio)
                .Where(x => x.Portfolio.ApplicationUserId == userId)
                .ToListAsync();
        }
    }
}
