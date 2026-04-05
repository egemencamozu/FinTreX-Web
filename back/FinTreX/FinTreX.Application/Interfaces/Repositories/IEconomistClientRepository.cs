using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IEconomistClientRepository : IGenericRepository<EconomistClient>
    {
        Task<IReadOnlyList<EconomistClient>> GetClientsByEconomistIdAsync(string economistId);
        Task<IReadOnlyList<EconomistClient>> GetEconomistsByClientIdAsync(string clientId);
        Task<bool> IsClientAssignedAsync(string economistId, string clientId);
        Task<int> GetActiveEconomistCountAsync(string clientId);
    }
}
