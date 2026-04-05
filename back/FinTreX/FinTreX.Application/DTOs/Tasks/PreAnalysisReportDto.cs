using System;

namespace FinTreX.Core.DTOs.Tasks
{
    public class PreAnalysisReportDto
    {
        public int Id { get; set; }
        public string Summary { get; set; }
        public string RiskLevel { get; set; }
        public string MarketOutlook { get; set; }
        public string KeyFindings { get; set; } // JSON list
        public string RawContent { get; set; }
        public DateTime GeneratedAtUtc { get; set; }
        public bool IsSuccessful { get; set; }
        public string ErrorMessage { get; set; }
    }
}
