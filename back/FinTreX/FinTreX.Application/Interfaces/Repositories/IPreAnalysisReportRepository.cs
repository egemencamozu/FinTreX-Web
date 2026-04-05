using FinTreX.Core.Entities;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPreAnalysisReportRepository : IGenericRepository<PreAnalysisReport>
    {
        Task DeleteByTaskIdAsync(int consultancyTaskId);
    }
}
