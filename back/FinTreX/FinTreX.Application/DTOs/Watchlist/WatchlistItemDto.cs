using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Watchlist
{
    public class WatchlistItemDto
    {
        public int Id { get; set; }
        public int WatchlistId { get; set; }
        public string Symbol { get; set; } = string.Empty;
        public AssetType AssetType { get; set; }
        public string? AssetName { get; set; }
        public string? Note { get; set; }
        public DateTime AddedAtUtc { get; set; }
    }
}
