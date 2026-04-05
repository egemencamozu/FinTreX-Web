using FinTreX.Core.DTOs.Economist;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IEconomistClientService
    {
        Task<IReadOnlyList<EconomistClientDto>> GetMyEconomistsAsync();
        Task<IReadOnlyList<EconomistClientDto>> GetMyClientsAsync();
        Task<EconomistClientDto> AssignEconomistAsync(string economistId, string notes = null);
        Task<bool> RemoveEconomistAsync(int assignmentId);
    }
}
