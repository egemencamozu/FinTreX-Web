using FinTreX.Core.Entities;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    /// <summary>
    /// Calls the Python PAA microservice to generate an objective pre-analysis
    /// report for a consultancy task. READ-ONLY access to portfolio data.
    /// Does NOT provide investment advice — objective data summarization only.
    /// </summary>
    public interface IPreAnalysisService
    {
        Task<PreAnalysisReport> GenerateReportAsync(int taskId, string userId);
    }
}
