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
        Task<PortfolioDto> UpdatePortfolioAsync(int portfolioId, UpdatePortfolioRequest request);
        Task<bool> DeletePortfolioAsync(int portfolioId);

        // Asset Management
        Task<PortfolioAssetDto> AddAssetAsync(int portfolioId, CreatePortfolioAssetRequest request);
        Task<PortfolioAssetDto> UpdateAssetAsync(int assetId, UpdatePortfolioAssetRequest request);
        Task<bool> RemoveAssetAsync(int assetId);
        Task<PortfolioOverviewDto> GetPortfolioOverviewAsync(int portfolioId, string? currency);
        Task<PortfolioHistoryDto> GetPortfolioHistoryAsync(int portfolioId, string? interval, string? currency);

        // Transaction Management
        Task<IReadOnlyList<PortfolioTransactionDto>> GetTransactionsAsync(int portfolioId);
        Task<PortfolioTransactionDto> AddTransactionAsync(int portfolioId, CreatePortfolioTransactionRequest request);
        Task<bool> DeleteTransactionAsync(int transactionId);

        // Economist access
        Task<IReadOnlyList<PortfolioDto>> GetClientPortfoliosAsync(string clientId);
        Task<PortfolioDto> SetPortfolioEconomistVisibilityAsync(int portfolioId, bool isHidden);
    }
}
