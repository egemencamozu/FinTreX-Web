using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Tasks
{
    public class ConsultancyTaskDto
    {
        public int Id { get; set; }
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string EconomistId { get; set; }
        public string EconomistName { get; set; }
        public TaskCategory Category { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public TaskPriority Priority { get; set; }
        public DateTime? Deadline { get; set; }
        public ConsultancyTaskStatus Status { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? CompletedAtUtc { get; set; }
        public PreAnalysisReportDto PreAnalysisReport { get; set; }
    }
}
