namespace FinTreX.Core.DTOs.Economist
{
    /// <summary>
    /// Lightweight projection for an economist user that a client can hire.
    /// </summary>
    public class AvailableEconomistDto
    {
        public string Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
    }
}
