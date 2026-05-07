namespace FinTreX.Core.DTOs.Support
{
    public class SupportTicketCreatedEventDto
    {
        public int TicketId { get; set; }
        public string Action { get; set; } = "Created";
        public string Subject { get; set; }
        public string Type { get; set; }
        public string UserName { get; set; }
    }
}
