using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Subscription
{
    public class UpdateSubscriptionPlanDto
    {
        [Required]
        [MaxLength(50)]
        public string DisplayName { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        [Range(0, 100000)]
        public decimal MonthlyPriceTRY { get; set; }

        [Range(0, 1000000)]
        public decimal YearlyPriceTRY { get; set; }

        [Range(1, 1000)]
        public int MaxEconomists { get; set; }

        public bool CanChangeEconomist { get; set; }

        public bool HasPrioritySupport { get; set; }

        public bool IsActive { get; set; }
        
        public List<PlanFeatureDto> Features { get; set; } = new();
    }
}
