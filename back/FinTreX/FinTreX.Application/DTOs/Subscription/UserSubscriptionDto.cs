using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.DTOs.Subscription
{
    public class UserSubscriptionDto
    {
        public int Id { get; set; }
        public SubscriptionPlanDto Plan { get; set; }
        public SubscriptionStatus Status { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public DateTime? CurrentPeriodEndUtc { get; set; }
        public DateTime? CancelledAtUtc { get; set; }
    }
}
