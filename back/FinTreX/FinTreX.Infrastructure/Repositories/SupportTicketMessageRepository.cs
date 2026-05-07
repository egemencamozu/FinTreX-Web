using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class SupportTicketMessageRepository : ISupportTicketMessageRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public SupportTicketMessageRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<SupportTicketMessage>> GetByTicketIdAsync(int ticketId)
        {
            return await _dbContext.SupportTicketMessages
                .Where(x => x.SupportTicketId == ticketId)
                .OrderBy(x => x.SentAtUtc)
                .ToListAsync();
        }

        public async Task AddAsync(SupportTicketMessage message)
        {
            _dbContext.SupportTicketMessages.Add(message);
            await _dbContext.SaveChangesAsync();
        }
    }
}
