using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class BulkDeactivateDto
    {
        [Required]
        public List<string> UserIds { get; set; } = new();

        [Required]
        public string DurationKey { get; set; } = "ONE_WEEK";
    }
}
