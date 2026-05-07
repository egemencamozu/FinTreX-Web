using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Bir izleme listesine eklenmiş tek bir sembol (hisse / kripto / değerli maden).
    /// Aynı sembol birden çok listede yer alabilir; (WatchlistId, Symbol) benzersizdir.
    /// </summary>
    public class WatchlistItem
    {
        public int Id { get; set; }

        public int WatchlistId { get; set; }

        /// <summary>Büyük harfe normalize edilmiş sembol (ör. "THYAO", "BTC", "GRAM").</summary>
        public string Symbol { get; set; } = string.Empty;

        public AssetType AssetType { get; set; }

        /// <summary>Opsiyonel görünen ad (ör. "Türk Hava Yolları", "Bitcoin").</summary>
        public string? AssetName { get; set; }

        /// <summary>Kullanıcı notu (ör. "Destekten alım", "Hedef 50").</summary>
        public string? Note { get; set; }

        public DateTime AddedAtUtc { get; set; } = DateTime.UtcNow;

        // ── Navigation ──────────────────────────────────────────────────────
        public Watchlist Watchlist { get; set; } = null!;
    }
}
