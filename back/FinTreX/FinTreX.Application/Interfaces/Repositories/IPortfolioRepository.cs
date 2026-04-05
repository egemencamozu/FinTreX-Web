using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPortfolioRepository : IGenericRepository<Portfolio>
    {
        Task<IReadOnlyList<Portfolio>> GetByUserIdAsync(string userId);
        Task<Portfolio> GetWithAssetsAsync(int portfolioId);
        Task<IReadOnlyList<Portfolio>> GetWithSubPortfoliosAsync(string userId);

        /// <summary>
        /// Returns all top-level portfolios with their assets for a user.
        /// Used by PAA for READ-ONLY portfolio summarization — never modifies data.
        /// </summary>
        Task<IReadOnlyList<Portfolio>> GetByUserIdWithAssetsAsync(string userId);
    }
}
