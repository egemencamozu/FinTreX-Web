using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Kullanıcı tarafından kurulmuş fiyat / yüzde alarmı.
    /// Arka planda çalışan AlertEvaluationService tarafından değerlendirilir
    /// ve tetiklendiğinde AlertsHub üzerinden push edilir, gerekirse e-posta gider.
    /// </summary>
    public class PriceAlert
    {
        public int Id { get; set; }

        /// <summary>Alarmı kuran kullanıcı.</summary>
        public string ApplicationUserId { get; set; } = string.Empty;

        public string Symbol { get; set; } = string.Empty;
        public AssetType AssetType { get; set; }
        public string? AssetName { get; set; }

        public AlertKind Kind { get; set; }
        public AlertDirection Direction { get; set; }

        /// <summary>
        /// PRICE modunda hedef fiyat; PERCENT modunda yüzde değeri (ör. 5 → %5).
        /// </summary>
        public decimal TargetValue { get; set; }

        /// <summary>
        /// PERCENT alarm için baz alınan fiyat — alarm kurulurken snapshot alınır.
        /// </summary>
        public decimal? BaselinePrice { get; set; }

        public string Currency { get; set; } = "TRY";

        public AlertRepeat Repeat { get; set; } = AlertRepeat.ONCE;

        /// <summary>Bildirim kanalları (Flags).</summary>
        public AlertChannel Channels { get; set; } = AlertChannel.IN_APP;

        public string? Note { get; set; }

        /// <summary>
        /// Alarm, belirli bir izleme listesine bağlı olabilir — aynı sembol farklı
        /// listelerde farklı alarmlara sahip olabileceğinden bu kolon nullable'dır.
        /// </summary>
        public int? WatchlistId { get; set; }

        public AlertStatus Status { get; set; } = AlertStatus.ACTIVE;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAtUtc { get; set; }
        public DateTime? TriggeredAtUtc { get; set; }
        public decimal? TriggeredPrice { get; set; }
        public int TriggerCount { get; set; }

        // ── Navigation ──────────────────────────────────────────────────────
        public Watchlist? Watchlist { get; set; }
    }
}
