using System;

namespace FinTreX.Core.DTOs.Tasks
{
    public class TaskRatedEventDto
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; }
        public string EconomistId { get; set; }
        public int Rating { get; set; }
        public string? Feedback { get; set; }
        public string UserName { get; set; }
        public DateTime RatedAtUtc { get; set; }
    }
}
