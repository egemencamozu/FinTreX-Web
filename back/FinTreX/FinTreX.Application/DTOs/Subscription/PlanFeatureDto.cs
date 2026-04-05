namespace FinTreX.Core.DTOs.Subscription
{
    public class PlanFeatureDto
    {
        public string Name { get; set; }
        public string Status { get; set; } // "included", "excluded", "hidden"
    }
}
