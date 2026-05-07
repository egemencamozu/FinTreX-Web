using System;
using System.Collections.Generic;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.PriceAlert
{
    public class PriceAlertDto
    {
        public int Id { get; set; }

        public string Symbol { get; set; } = string.Empty;
        public AssetType AssetType { get; set; }
        public string? AssetName { get; set; }

        public AlertKind Kind { get; set; }
        public AlertDirection Direction { get; set; }
        public decimal TargetValue { get; set; }
        public decimal? BaselinePrice { get; set; }
        public string Currency { get; set; } = "TRY";

        public AlertRepeat Repeat { get; set; }

        /// <summary>UI tarafı string listesi bekliyor (ör. ["IN_APP", "EMAIL"]).</summary>
        public List<string> Channels { get; set; } = new();

        public string? Note { get; set; }

        public int? WatchlistId { get; set; }

        public AlertStatus Status { get; set; }

        public DateTime CreatedAtUtc { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
        public DateTime? TriggeredAtUtc { get; set; }
        public decimal? TriggeredPrice { get; set; }
        public int TriggerCount { get; set; }
    }
}
