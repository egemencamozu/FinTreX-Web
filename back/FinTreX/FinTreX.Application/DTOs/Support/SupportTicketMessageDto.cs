using System;

namespace FinTreX.Core.DTOs.Support
{
    public class SupportTicketMessageDto
    {
        public int Id { get; set; }
        public int SupportTicketId { get; set; }
        public string SenderId { get; set; }
        public string SenderRole { get; set; }
        public string SenderName { get; set; }
        public string Body { get; set; }
        public DateTime SentAtUtc { get; set; }
    }
}
