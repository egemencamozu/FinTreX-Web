namespace FinTreX.Core.DTOs.Economist
{
    public class EconomistClientChangedEventDto
    {
        public int AssignmentId { get; set; }
        public string Action { get; set; } = "Reassigned";
        public string ClientId { get; set; } = string.Empty;
        public string? ClientName { get; set; }
        public string? EconomistId { get; set; }
        public string? EconomistName { get; set; }
        public string? PreviousEconomistId { get; set; }
        public string? PreviousEconomistName { get; set; }
    }
}
