using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    /// <summary>Request to initiate forgot-password flow.</summary>
    public class ForgotPasswordRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; }
    }
}
