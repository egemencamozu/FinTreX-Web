using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Watchlist
{
    /// <summary>
    /// Tek bir sembolün hangi watchlist'lerde bulunması gerektiğini tek istekle
    /// senkronize eder: verilen listelerden eksik olanlara eklenir, içinde olup
    /// listede olmayanlardan silinir.
    /// </summary>
    public class ToggleSymbolRequest
    {
        [Required]
        [StringLength(24, MinimumLength = 1)]
        public string Symbol { get; set; } = string.Empty;

        [Required]
        public AssetType AssetType { get; set; }

        [StringLength(120)]
        public string? AssetName { get; set; }

        /// <summary>Sembolün nihai olarak yer alması gereken watchlist id listesi.</summary>
        public List<int> WatchlistIds { get; set; } = new();
    }

    public class ToggleSymbolResponse
    {
        public string Symbol { get; set; } = string.Empty;
        public List<int> WatchlistIds { get; set; } = new();
    }
}
