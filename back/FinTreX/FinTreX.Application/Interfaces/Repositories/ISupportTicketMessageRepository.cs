using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface ISupportTicketMessageRepository
    {
        Task<IReadOnlyList<SupportTicketMessage>> GetByTicketIdAsync(int ticketId);
        Task AddAsync(SupportTicketMessage message);
    }
}
