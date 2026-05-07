using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPortfolioTransactionRepository : IGenericRepository<PortfolioTransaction>
    {
        Task<IReadOnlyList<PortfolioTransaction>> GetByPortfolioIdAsync(int portfolioId);
    }
}
