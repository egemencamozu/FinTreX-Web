namespace FinTreX.Core.DTOs.Support
{
    public class SupportTicketUpdatedEventDto
    {
        public int TicketId { get; set; }
        public string Subject { get; set; }
        public string Status { get; set; }
        public bool HasAdminResponse { get; set; }
        public string UpdatedByName { get; set; }
    }
}
