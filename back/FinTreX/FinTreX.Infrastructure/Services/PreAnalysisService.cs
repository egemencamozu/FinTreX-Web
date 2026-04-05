using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class PreAnalysisService : IPreAnalysisService
    {
        private readonly HttpClient _httpClient;
        private readonly IPortfolioRepository _portfolioRepository;
        private readonly IConsultancyTaskRepository _taskRepository;
        private readonly ILogger<PreAnalysisService> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        public PreAnalysisService(
            HttpClient httpClient,
            IPortfolioRepository portfolioRepository,
            IConsultancyTaskRepository taskRepository,
            ILogger<PreAnalysisService> logger)
        {
            _httpClient = httpClient;
            _portfolioRepository = portfolioRepository;
            _taskRepository = taskRepository;
            _logger = logger;
        }

        public async Task<PreAnalysisReport> GenerateReportAsync(int taskId, string userId)
        {
            try
            {
                var task = await _taskRepository.GetByIdAsync(taskId)
                    ?? throw new InvalidOperationException($"Task {taskId} not found.");

                // READ-ONLY — portföy verilerini sadece okuyoruz, değiştirmiyoruz
                var portfolios = await _portfolioRepository.GetByUserIdWithAssetsAsync(userId);

                if (!portfolios.Any())
                {
                    _logger.LogWarning("PAA skipped for task {TaskId}: user {UserId} has no portfolios.", taskId, userId);
                    return new PreAnalysisReport
                    {
                        ConsultancyTaskId = taskId,
                        Summary = string.Empty,
                        RiskLevel = string.Empty,
                        MarketOutlook = string.Empty,
                        KeyFindings = "[]",
                        RawContent = string.Empty,
                        IsSuccessful = false,
                        ErrorMessage = "Kullanıcının henüz portföyü bulunmuyor. Portföy eklendikten sonra analiz yeniden talep edilebilir.",
                        GeneratedAtUtc = DateTime.UtcNow,
                    };
                }

                var payload = new
                {
                    task_id = task.Id,
                    task_title = task.Title,
                    task_description = task.Description,
                    task_category = task.Category.ToString(),
                    user_portfolios = portfolios.Select(p => new
                    {
                        portfolio_id = p.Id,
                        name = p.Name,
                        description = p.Description,
                        assets = p.Assets.Select(a => new
                        {
                            symbol = a.Symbol,
                            asset_name = a.AssetName,
                            asset_type = a.AssetType.ToString(),
                            quantity = (double)a.Quantity,
                            average_cost = (double)a.AverageCost,
                            currency = a.Currency,
                            current_value = a.CurrentValue.HasValue ? (double?)a.CurrentValue.Value : null,
                            notes = a.Notes
                        }),
                        sub_portfolios = Array.Empty<object>()
                    })
                };

                var response = await _httpClient.PostAsJsonAsync("/analyze", payload, _jsonOptions);
                response.EnsureSuccessStatusCode();

                var result = await response.Content.ReadFromJsonAsync<PaaResponse>(_jsonOptions)
                    ?? throw new InvalidOperationException("PAA service returned null response.");

                return new PreAnalysisReport
                {
                    ConsultancyTaskId = taskId,
                    Summary = result.Summary ?? string.Empty,
                    RiskLevel = result.RiskLevel ?? "Medium",
                    MarketOutlook = result.MarketOutlook ?? string.Empty,
                    KeyFindings = result.KeyFindings ?? "[]",
                    RawContent = result.RawContent ?? string.Empty,
                    IsSuccessful = result.IsSuccessful,
                    ErrorMessage = result.ErrorMessage,
                    GeneratedAtUtc = DateTime.UtcNow,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PAA report generation failed for task {TaskId}", taskId);

                return new PreAnalysisReport
                {
                    ConsultancyTaskId = taskId,
                    Summary = string.Empty,
                    RiskLevel = string.Empty,
                    MarketOutlook = string.Empty,
                    KeyFindings = "[]",
                    RawContent = string.Empty,
                    IsSuccessful = false,
                    ErrorMessage = $"PAA service error: {ex.Message}",
                    GeneratedAtUtc = DateTime.UtcNow,
                };
            }
        }

        private sealed class PaaResponse
        {
            public int TaskId { get; set; }
            public string Summary { get; set; }
            public string RiskLevel { get; set; }
            public string MarketOutlook { get; set; }
            public string KeyFindings { get; set; }
            public string RawContent { get; set; }
            public bool IsSuccessful { get; set; }
            public string ErrorMessage { get; set; }
            public string GeneratedAtUtc { get; set; }
        }
    }
}
