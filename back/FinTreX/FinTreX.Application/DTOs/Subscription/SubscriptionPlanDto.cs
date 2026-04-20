using FinTreX.Core.Enums;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Subscription
{
    public class SubscriptionPlanDto
    {
        public int Id { get; set; }
        public SubscriptionTier Tier { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public decimal MonthlyPriceTRY { get; set; }
        public decimal YearlyPriceTRY { get; set; }
        public int MaxEconomists { get; set; }
        public bool CanChangeEconomist { get; set; }
        public bool HasPrioritySupport { get; set; }
        public bool IsActive { get; set; }
        public string? StripeProductId { get; set; }
        public string? StripeMonthlyPriceId { get; set; }
        public string? StripeYearlyPriceId { get; set; }
        public List<PlanFeatureDto> Features { get; set; } = new();
    }
}
