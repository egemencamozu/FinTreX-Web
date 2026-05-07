using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Watchlist
{
    public class AddWatchlistItemRequest
    {
        [Required]
        [StringLength(24, MinimumLength = 1)]
        public string Symbol { get; set; } = string.Empty;

        [Required]
        public AssetType AssetType { get; set; }

        [StringLength(120)]
        public string? AssetName { get; set; }

        [StringLength(500)]
        public string? Note { get; set; }
    }
}
