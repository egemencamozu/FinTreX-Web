using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface ISupportTicketRepository : IGenericRepository<SupportTicket>
    {
        Task<IReadOnlyList<SupportTicket>> GetByUserIdAsync(string userId);
        Task<IReadOnlyList<SupportTicket>> GetAllOrderedAsync();
        Task<int> CountOpenAsync();
    }
}
