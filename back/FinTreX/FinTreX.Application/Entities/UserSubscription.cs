using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Tracks a user's active subscription (1:1 per user).
    /// Links to SubscriptionPlan to determine features and limits.
    /// </summary>
    public class UserSubscription
    {
        public int Id { get; set; }

        /// <summary>FK to the subscribing user.</summary>
        public string ApplicationUserId { get; set; }

        /// <summary>FK to the selected subscription plan.</summary>
        public int SubscriptionPlanId { get; set; }

        public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;

        public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>End of the current billing period (null for free tier).</summary>
        public DateTime? CurrentPeriodEndUtc { get; set; }

        /// <summary>When the subscription was cancelled (null if active).</summary>
        public DateTime? CancelledAtUtc { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // ── Navigation ───────────────────────────────────────────────────────
        public SubscriptionPlan SubscriptionPlan { get; set; }
    }
}
