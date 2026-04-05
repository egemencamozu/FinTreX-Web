using FinTreX.Core.DTOs.Portfolio;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IPortfolioService
    {
        Task<IReadOnlyList<PortfolioDto>> GetUserPortfoliosAsync();
        Task<PortfolioDto> GetPortfolioByIdAsync(int portfolioId);
        Task<PortfolioDto> CreatePortfolioAsync(CreatePortfolioRequest request);
        Task<bool> DeletePortfolioAsync(int portfolioId);

        // Asset Management
        Task<PortfolioAssetDto> AddAssetAsync(int portfolioId, CreatePortfolioAssetRequest request);
        Task<PortfolioAssetDto> UpdateAssetAsync(int assetId, UpdatePortfolioAssetRequest request);
        Task<bool> RemoveAssetAsync(int assetId);

        // Economist access
        Task<IReadOnlyList<PortfolioDto>> GetClientPortfoliosAsync(string clientId);
    }
}
