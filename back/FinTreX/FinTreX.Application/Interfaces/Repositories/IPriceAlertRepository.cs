using System.Collections.Generic;
using System.Threading.Tasks;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPriceAlertRepository : IGenericRepository<PriceAlert>
    {
        Task<IReadOnlyList<PriceAlert>> GetByUserIdAsync(
            string userId,
            AlertStatus? status = null,
            string? symbol = null);

        Task<PriceAlert?> GetByIdAndUserAsync(int id, string userId);

        /// <summary>
        /// Değerlendirme motoru için: belirli bir varlık türünde tüm aktif alarmları çeker.
        /// </summary>
        Task<IReadOnlyList<PriceAlert>> GetActiveByAssetTypeAsync(AssetType assetType);

        Task<IReadOnlyList<PriceAlert>> GetActiveForSymbolAsync(AssetType assetType, string symbol);
    }
}
