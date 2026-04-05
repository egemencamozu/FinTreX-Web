using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class EconomistClientRepository : GenericRepository<EconomistClient>, IEconomistClientRepository
    {
        public EconomistClientRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<EconomistClient>> GetClientsByEconomistIdAsync(string economistId)
        {
            return await _dbContext.EconomistClients
                .Where(x => x.EconomistId == economistId && x.IsActive)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<EconomistClient>> GetEconomistsByClientIdAsync(string clientId)
        {
            return await _dbContext.EconomistClients
                .Where(x => x.ClientId == clientId && x.IsActive)
                .ToListAsync();
        }

        public async Task<bool> IsClientAssignedAsync(string economistId, string clientId)
        {
            return await _dbContext.EconomistClients
                .AnyAsync(x => x.EconomistId == economistId && x.ClientId == clientId && x.IsActive);
        }

        public async Task<int> GetActiveEconomistCountAsync(string clientId)
        {
            return await _dbContext.EconomistClients
                .CountAsync(x => x.ClientId == clientId && x.IsActive);
        }
    }
}
