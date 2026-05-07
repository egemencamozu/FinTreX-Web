using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Support
{
    /// <summary>Admin-only: update a support ticket's status.</summary>
    public class UpdateSupportTicketRequest
    {
        [Required]
        public SupportTicketStatus Status { get; set; }
    }
}
