using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A support ticket (complaint / support / suggestion / request) submitted
    /// by a user and handled by the admin team.
    /// </summary>
    public class SupportTicket
    {
        public int Id { get; set; }

        /// <summary>The user who created this ticket.</summary>
        public string UserId { get; set; }

        public SupportTicketType Type { get; set; }

        /// <summary>Short subject (e.g. "Ödeme alınamıyor").</summary>
        public string Subject { get; set; }

        public SupportTicketStatus Status { get; set; } = SupportTicketStatus.Open;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Last time an admin changed status on this ticket.</summary>
        public DateTime? RespondedAtUtc { get; set; }

        /// <summary>Id of the admin that last handled this ticket.</summary>
        public string? HandledByAdminId { get; set; }
    }
}
