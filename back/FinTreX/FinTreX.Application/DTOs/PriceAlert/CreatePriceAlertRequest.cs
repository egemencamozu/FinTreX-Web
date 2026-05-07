using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.PriceAlert
{
    public class CreatePriceAlertRequest
    {
        [Required]
        [StringLength(24, MinimumLength = 1)]
        public string Symbol { get; set; } = string.Empty;

        [Required]
        public AssetType AssetType { get; set; }

        [StringLength(120)]
        public string? AssetName { get; set; }

        [Required]
        public AlertKind Kind { get; set; }

        [Required]
        public AlertDirection Direction { get; set; }

        [Required]
        [Range(
            typeof(decimal),
            "0.00000001",
            "999999999999",
            ParseLimitsInInvariantCulture = true,
            ConvertValueInInvariantCulture = true)]
        public decimal TargetValue { get; set; }

        /// <summary>
        /// PERCENT tipli alarmlar için baz alınan fiyat. Gönderilmezse sunucu
        /// <see cref="Symbol"/> için son bilinen fiyatı snapshot olarak alır.
        /// </summary>
        public decimal? BaselinePrice { get; set; }

        [StringLength(8)]
        public string? Currency { get; set; }

        public AlertRepeat Repeat { get; set; } = AlertRepeat.ONCE;

        /// <summary>Sadece ["IN_APP", "EMAIL"] değerleri kabul edilir.</summary>
        public List<string>? Channels { get; set; }

        [StringLength(500)]
        public string? Note { get; set; }

        public int? WatchlistId { get; set; }
    }
}
