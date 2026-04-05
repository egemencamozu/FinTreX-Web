using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class PortfolioRepository : GenericRepository<Portfolio>, IPortfolioRepository
    {
        public PortfolioRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<Portfolio>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.Portfolios
                .Where(x => x.ApplicationUserId == userId && x.ParentPortfolioId == null)
                .Include(x => x.Assets)
                .ToListAsync();
        }

        public async Task<Portfolio> GetWithAssetsAsync(int portfolioId)
        {
            return await _dbContext.Portfolios
                .Include(x => x.Assets)
                .FirstOrDefaultAsync(x => x.Id == portfolioId);
        }

        public async Task<IReadOnlyList<Portfolio>> GetWithSubPortfoliosAsync(string userId)
        {
            return await _dbContext.Portfolios
                .Where(x => x.ApplicationUserId == userId)
                .Include(x => x.SubPortfolios)
                .ToListAsync();
        }

        /// <summary>
        /// READ-ONLY: Returns all top-level portfolios with their assets.
        /// Called exclusively by PAA microservice — AsNoTracking enforced.
        /// </summary>
        public async Task<IReadOnlyList<Portfolio>> GetByUserIdWithAssetsAsync(string userId)
        {
            return await _dbContext.Portfolios
                .Where(x => x.ApplicationUserId == userId && x.ParentPortfolioId == null)
                .Include(x => x.Assets)
                .AsNoTracking()
                .ToListAsync();
        }
    }
}
