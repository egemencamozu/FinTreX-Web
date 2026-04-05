using FinTreX.Core.Enums;
using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Tasks
{
    public class UpdateTaskStatusRequest
    {
        [Required]
        public ConsultancyTaskStatus Status { get; set; }
    }
}
