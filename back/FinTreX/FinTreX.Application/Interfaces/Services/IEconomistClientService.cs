using FinTreX.Core.DTOs.Economist;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IEconomistClientService
    {
        Task<IReadOnlyList<EconomistClientDto>> GetMyEconomistsAsync();
        Task<IReadOnlyList<EconomistClientDto>> GetMyClientsAsync();
        Task<IReadOnlyList<EconomistClientDto>> AdminGetClientEconomistsAsync(string clientId);
        Task<EconomistClientDto> AssignEconomistAsync(string economistId, string notes = null);
        Task<EconomistClientDto> AdminChangeAssignmentAsync(int assignmentId, string newEconomistId, string notes = null);
        Task<EconomistClientDto> AdminRemoveAssignmentAsync(int assignmentId, string notes = null);
    }
}
