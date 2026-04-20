using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// End-of-session daily close snapshot stored for BIST stocks and indices.
    /// </summary>
    public class DailyClose
    {
        public int Id { get; set; }
        public string Ticker { get; set; } = default!;
        public string AssetType { get; set; } = default!; // STOCK | INDEX
        public decimal ClosePrice { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public long? Volume { get; set; } // null for index rows
        public DateOnly Date { get; set; } // market date in Europe/Istanbul
        public DateTime WrittenAt { get; set; } // audit timestamp in UTC
    }
}
