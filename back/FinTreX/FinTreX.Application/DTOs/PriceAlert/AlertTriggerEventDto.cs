using System;

namespace FinTreX.Core.DTOs.PriceAlert
{
    /// <summary>
    /// SignalR üzerinden kullanıcıya push edilen alarm tetik olayı.
    /// Frontend tarafında canlı toast / liste güncellemesi için kullanılır.
    /// </summary>
    public class AlertTriggerEventDto
    {
        public int AlertId { get; set; }
        public string Symbol { get; set; } = string.Empty;
        public string? AssetName { get; set; }
        public decimal TriggeredPrice { get; set; }
        public decimal TargetValue { get; set; }
        public string Kind { get; set; } = "PRICE";
        public string Direction { get; set; } = "ABOVE";
        public DateTime TriggeredAtUtc { get; set; }
    }
}
