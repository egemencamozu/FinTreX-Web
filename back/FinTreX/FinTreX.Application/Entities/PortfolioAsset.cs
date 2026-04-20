using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A single financial asset held within a Portfolio.
    /// Linked to Portfolio (not directly to User) to support multi-portfolio hierarchy.
    /// </summary>
    public class PortfolioAsset
    {
        public int Id { get; set; }

        /// <summary>FK to the owning portfolio.</summary>
        public int PortfolioId { get; set; }

        /// <summary>Ticker symbol (e.g. "THYAO", "BTC", "XAU").</summary>
        public string Symbol { get; set; }

        /// <summary>Human-readable asset name (e.g. "Türk Hava Yolları", "Bitcoin").</summary>
        public string AssetName { get; set; }

        /// <summary>Asset category: BIST, Crypto, or PreciousMetal.</summary>
        public AssetType AssetType { get; set; }

        /// <summary>Quantity held (shares, coins, grams etc.).</summary>
        public decimal Quantity { get; set; }

        /// <summary>Average cost per unit at acquisition.</summary>
        public decimal AverageCost { get; set; }

        /// <summary>Currency code (e.g. "TRY", "USD", "EUR").</summary>
        public string Currency { get; set; }

        /// <summary>Current market value per unit — nullable, updated externally.</summary>
        public decimal? CurrentValue { get; set; }

        /// <summary>When the current value was last refreshed.</summary>
        public DateTime? CurrentValueUpdatedAtUtc { get; set; }

        /// <summary>Date the asset was originally acquired.</summary>
        public DateTime AcquiredAtUtc { get; set; }

        /// <summary>Optional user note for this asset.</summary>
        public string? Notes { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAtUtc { get; set; }

        // ── Navigation ───────────────────────────────────────────────────────
        public Portfolio Portfolio { get; set; }
    }
}
