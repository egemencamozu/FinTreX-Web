using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    public class DeleteAccountRequest
    {
        [Required]
        public string Password { get; set; }

        [Required, StringLength(6, MinimumLength = 6)]
        public string VerificationCode { get; set; }
    }
}
