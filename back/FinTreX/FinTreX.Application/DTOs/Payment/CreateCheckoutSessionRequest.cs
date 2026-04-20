namespace FinTreX.Core.DTOs.Payment
{
    public class CreateCheckoutSessionRequest
    {
        public int PlanId { get; set; }
        public string BillingPeriod { get; set; } = "monthly"; // "monthly" | "yearly"
    }
}
