using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Tasks
{
    public class RateTaskRequest
    {
        [Required]
        [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5.")]
        public int Rating { get; set; }

        [MaxLength(1000)]
        public string? Feedback { get; set; }
    }
}
