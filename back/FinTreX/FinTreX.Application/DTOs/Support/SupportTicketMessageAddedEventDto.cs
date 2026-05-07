namespace FinTreX.Core.DTOs.Support
{
    public class SupportTicketMessageAddedEventDto
    {
        public int TicketId { get; set; }
        public int MessageId { get; set; }
        public string SenderRole { get; set; }
        public string SenderName { get; set; }
    }
}
