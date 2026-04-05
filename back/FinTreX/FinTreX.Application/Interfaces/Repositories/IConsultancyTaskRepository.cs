using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IConsultancyTaskRepository : IGenericRepository<ConsultancyTask>
    {
        Task<IReadOnlyList<ConsultancyTask>> GetByUserIdAsync(string userId);
        Task<IReadOnlyList<ConsultancyTask>> GetByEconomistIdAsync(string economistId);
        Task<ConsultancyTask> GetWithPreAnalysisAsync(int taskId);
    }
}
