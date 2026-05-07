namespace FinTreX.Core.DTOs.Portfolio
{
    public class UpdatePortfolioRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
