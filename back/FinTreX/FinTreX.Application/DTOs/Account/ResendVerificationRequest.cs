using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class ResendVerificationRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; }
    }
}
