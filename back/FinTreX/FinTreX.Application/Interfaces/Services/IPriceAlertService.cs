using System.Collections.Generic;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.Enums;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IPriceAlertService
    {
        Task<IReadOnlyList<PriceAlertDto>> GetMyAlertsAsync(AlertStatus? status = null, string? symbol = null);
        Task<PriceAlertDto> GetByIdAsync(int id);
        Task<PriceAlertDto> CreateAsync(CreatePriceAlertRequest request);
        Task<PriceAlertDto> UpdateAsync(int id, UpdatePriceAlertRequest request);
        Task<bool> DeleteAsync(int id);

        Task<PriceAlertDto> PauseAsync(int id);
        Task<PriceAlertDto> ResumeAsync(int id);
    }
}
