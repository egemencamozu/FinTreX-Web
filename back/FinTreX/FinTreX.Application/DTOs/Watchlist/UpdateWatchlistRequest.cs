using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Watchlist
{
    public class UpdateWatchlistRequest
    {
        [StringLength(60, MinimumLength = 1)]
        public string? Name { get; set; }

        [StringLength(16)]
        public string? Color { get; set; }

        public int? SortOrder { get; set; }
    }
}
