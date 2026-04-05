using FinTreX.Core.DTOs.Tasks;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IConsultancyTaskService
    {
        Task<IReadOnlyList<ConsultancyTaskDto>> GetMyTasksAsync();
        Task<ConsultancyTaskDto> GetTaskByIdAsync(int taskId);
        Task<ConsultancyTaskDto> CreateTaskAsync(CreateConsultancyTaskRequest request);
        Task<bool> UpdateTaskStatusAsync(int taskId, UpdateTaskStatusRequest request);
        Task<ConsultancyTaskDto> GeneratePreAnalysisAsync(int taskId);
    }
}
