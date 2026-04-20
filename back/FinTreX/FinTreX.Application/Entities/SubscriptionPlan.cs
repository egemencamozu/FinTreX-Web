using FinTreX.Core.Enums;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Defines a subscription plan with its features and limits.
    /// Seeded as reference data: Default, Premium, Ultra.
    /// </summary>
    public class SubscriptionPlan
    {
        public int Id { get; set; }

        /// <summary>Tier identifier: Default, Premium, Ultra.</summary>
        public SubscriptionTier Tier { get; set; }

        /// <summary>User-facing display name (e.g. "Ücretsiz", "Premium", "Ultra").</summary>
        public string DisplayName { get; set; }

        public string Description { get; set; }

        /// <summary>Monthly price in TRY (0 for free tier).</summary>
        public decimal MonthlyPriceTRY { get; set; }

        /// <summary>Yearly price in TRY (Usually with a discount).</summary>
        public decimal YearlyPriceTRY { get; set; }

        /// <summary>Maximum number of economists a user can be assigned to. 999 = unlimited.</summary>
        public int MaxEconomists { get; set; }

        /// <summary>Whether the user can change their assigned economist(s).</summary>
        public bool CanChangeEconomist { get; set; }

        /// <summary>Priority support access.</summary>
        public bool HasPrioritySupport { get; set; }

        /// <summary>Whether this plan is currently available for selection.</summary>
        public bool IsActive { get; set; } = true;

        /// <summary>JSON serialized list of features.</summary>
        public string? FeaturesJson { get; set; }
        
        /// <summary>Stripe Product ID (e.g. "prod_xxx").</summary>
        public string? StripeProductId { get; set; }

        /// <summary>Stripe Price ID for monthly billing (e.g. "price_xxx").</summary>
        public string? StripeMonthlyPriceId { get; set; }

        /// <summary>Stripe Price ID for yearly billing (e.g. "price_xxx").</summary>
        public string? StripeYearlyPriceId { get; set; }
    }
}
