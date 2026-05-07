using System;

namespace FinTreX.Core.DTOs.Watchlist
{
    /// <summary>Tek bir izleme listesinin özet görünümü (UI list card).</summary>
    public class WatchlistDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Color { get; set; }
        public int SortOrder { get; set; }
        public bool IsDefault { get; set; }
        public int ItemCount { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
    }
}
