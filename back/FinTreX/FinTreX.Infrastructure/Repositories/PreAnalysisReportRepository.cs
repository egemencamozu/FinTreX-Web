using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class PreAnalysisReportRepository
        : GenericRepository<PreAnalysisReport>, IPreAnalysisReportRepository
    {
        public PreAnalysisReportRepository(ApplicationDbContext dbContext) : base(dbContext)
        {
        }

        public async Task DeleteByTaskIdAsync(int consultancyTaskId)
        {
            await _dbContext.PreAnalysisReports
                .Where(r => r.ConsultancyTaskId == consultancyTaskId)
                .ExecuteDeleteAsync();
        }
    }
}
