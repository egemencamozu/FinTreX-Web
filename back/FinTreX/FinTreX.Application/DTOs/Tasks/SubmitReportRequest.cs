using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Tasks
{
    public class SubmitReportRequest
    {
        [Required]
        [MaxLength(8000)]
        public string Report { get; set; }
    }
}
