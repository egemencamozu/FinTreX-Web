using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    /// <summary>
    /// Self-service password change for an authenticated user.
    /// Requires the current password to prevent session-hijack takeovers.
    /// </summary>
    public class ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 8)]
        public string NewPassword { get; set; }

        [Required]
        [Compare(nameof(NewPassword), ErrorMessage = "Şifreler eşleşmiyor.")]
        public string ConfirmNewPassword { get; set; }
    }
}
