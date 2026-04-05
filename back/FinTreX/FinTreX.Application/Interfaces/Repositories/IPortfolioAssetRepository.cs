using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPortfolioAssetRepository : IGenericRepository<PortfolioAsset>
    {
        Task<IReadOnlyList<PortfolioAsset>> GetByPortfolioIdAsync(int portfolioId);
        Task<IReadOnlyList<PortfolioAsset>> GetByUserIdAsync(string userId);
    }
}
