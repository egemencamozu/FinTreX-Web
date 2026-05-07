using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System;

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

        public async Task<Dictionary<string, (double Average, int Count)>> GetRatingStatsByEconomistIdsAsync(IEnumerable<string> economistIds)
        {
            var stats = await _dbContext.ConsultancyTasks
                .Where(t => economistIds.Contains(t.EconomistId) && t.Rating.HasValue)
                .GroupBy(t => t.EconomistId)
                .Select(g => new
                {
                    EconomistId = g.Key,
                    Average = g.Average(t => (double)t.Rating!.Value),
                    Count = g.Count()
                })
                .ToListAsync();

            return stats.ToDictionary(
                x => x.EconomistId,
                x => (x.Average, x.Count));
        }

        public async Task<IReadOnlyList<ConsultancyTask>> GetRatedTasksByEconomistIdAsync(string economistId)
        {
            return await _dbContext.ConsultancyTasks
                .Where(t => t.EconomistId == economistId && t.Rating.HasValue)
                .OrderByDescending(t => t.RatedAtUtc)
                .ToListAsync();
        }
    }
}
