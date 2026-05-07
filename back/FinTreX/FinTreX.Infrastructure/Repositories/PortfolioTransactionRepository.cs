using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class PortfolioTransactionRepository : GenericRepository<PortfolioTransaction>, IPortfolioTransactionRepository
    {
        public PortfolioTransactionRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<PortfolioTransaction>> GetByPortfolioIdAsync(int portfolioId)
        {
            return await _dbContext.PortfolioTransactions
                .Where(t => t.PortfolioId == portfolioId)
                .OrderByDescending(t => t.ExecutedAtUtc)
                .ToListAsync();
        }
    }
}
