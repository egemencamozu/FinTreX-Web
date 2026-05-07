using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class SupportTicketRepository : GenericRepository<SupportTicket>, ISupportTicketRepository
    {
        public SupportTicketRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<SupportTicket>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.SupportTickets
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAtUtc)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<SupportTicket>> GetAllOrderedAsync()
        {
            return await _dbContext.SupportTickets
                .OrderByDescending(x => x.CreatedAtUtc)
                .ToListAsync();
        }

        public async Task<int> CountOpenAsync()
        {
            return await _dbContext.SupportTickets
                .CountAsync(x => x.Status == Core.Enums.SupportTicketStatus.Open);
        }
    }
}
