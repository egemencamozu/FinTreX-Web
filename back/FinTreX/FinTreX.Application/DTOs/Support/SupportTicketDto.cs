using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Support
{
    public class SupportTicketDto
    {
        public int Id { get; set; }
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string UserEmail { get; set; }
        /// <summary>Role of the submitter (e.g. "User", "Economist") — shown to admins.</summary>
        public string UserRole { get; set; }
        public SupportTicketType Type { get; set; }
        public string Subject { get; set; }
        public SupportTicketStatus Status { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? RespondedAtUtc { get; set; }
        public string? HandledByAdminId { get; set; }
    }
}
