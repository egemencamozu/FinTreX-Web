using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Watchlist
{
    public class CreateWatchlistRequest
    {
        [Required]
        [StringLength(60, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;

        [StringLength(16)]
        public string? Color { get; set; }
    }
}
