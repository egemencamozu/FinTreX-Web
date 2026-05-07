using System;

namespace FinTreX.Core.Entities
{
    public class SupportTicketMessage
    {
        public int Id { get; set; }
        public int SupportTicketId { get; set; }
        public string SenderId { get; set; }

        /// <summary>"User" veya "Admin"</summary>
        public string SenderRole { get; set; }

        /// <summary>Görüntüleme için denormalize isim.</summary>
        public string SenderName { get; set; }

        public string Body { get; set; }
        public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;

        public SupportTicket SupportTicket { get; set; }
    }
}
