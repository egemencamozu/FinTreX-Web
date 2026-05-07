using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Account
{
    /// <summary>
    /// Payload for the self-service profile update endpoint (PUT /me).
    /// Email is intentionally excluded — changing email requires a
    /// separate re-verification flow.
    /// </summary>
    public class UpdateMyProfileDto
    {
        [Required]
        [StringLength(50, MinimumLength = 2)]
        public string FirstName { get; set; }

        [Required]
        [StringLength(50, MinimumLength = 2)]
        public string LastName { get; set; }

        [Phone]
        [StringLength(32)]
        public string PhoneNumber { get; set; }
    }
}
