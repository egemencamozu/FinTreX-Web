using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class RequestDeletionCodeDto
    {
        [Required]
        public string Password { get; set; }
    }
}
