using System;
using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Tasks
{
    public class CreateConsultancyTaskRequest
    {
        [Required]
        public string EconomistId { get; set; }

        [Required]
        public TaskCategory Category { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Description { get; set; }

        public TaskPriority Priority { get; set; } = TaskPriority.Medium;

        public DateTime? Deadline { get; set; }
    }
}
