using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class BulkActivateDto
    {
        [Required]
        public List<string> UserIds { get; set; } = new();
    }
}
