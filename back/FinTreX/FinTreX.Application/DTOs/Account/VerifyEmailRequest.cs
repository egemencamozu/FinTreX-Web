using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class VerifyEmailRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; }

        [Required, StringLength(6, MinimumLength = 6)]
        public string Code { get; set; }
    }
}
