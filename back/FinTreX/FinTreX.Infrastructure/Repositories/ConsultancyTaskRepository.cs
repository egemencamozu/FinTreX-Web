using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class ConsultancyTaskRepository : GenericRepository<ConsultancyTask>, IConsultancyTaskRepository
    {
        public ConsultancyTaskRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task<IReadOnlyList<ConsultancyTask>> GetByUserIdAsync(string userId)
        {
            return await _dbContext.ConsultancyTasks
                .Include(x => x.PreAnalysisReport)
                .Where(x => x.UserId == userId)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<ConsultancyTask>> GetByEconomistIdAsync(string economistId)
        {
            return await _dbContext.ConsultancyTasks
                .Include(x => x.PreAnalysisReport)
                .Where(x => x.EconomistId == economistId)
                .ToListAsync();
        }

        public async Task<ConsultancyTask> GetWithPreAnalysisAsync(int taskId)
        {
            return await _dbContext.ConsultancyTasks
                .Include(x => x.PreAnalysisReport)
                .FirstOrDefaultAsync(x => x.Id == taskId);
        }
    }
}
