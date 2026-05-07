using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.PriceAlert
{
    public class UpdatePriceAlertRequest
    {
        public AlertDirection? Direction { get; set; }

        [Range(
            typeof(decimal),
            "0.00000001",
            "999999999999",
            ParseLimitsInInvariantCulture = true,
            ConvertValueInInvariantCulture = true)]
        public decimal? TargetValue { get; set; }

        public decimal? BaselinePrice { get; set; }

        public AlertKind? Kind { get; set; }
        public AlertRepeat? Repeat { get; set; }

        public List<string>? Channels { get; set; }

        [StringLength(500)]
        public string? Note { get; set; }

        public int? WatchlistId { get; set; }
    }
}
