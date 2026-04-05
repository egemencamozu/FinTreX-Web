using System;
using System.Collections.Generic;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Represents a user's portfolio container.
    /// Supports multi-portfolio and sub-portfolio hierarchy via self-referencing FK.
    /// A user can have multiple top-level portfolios (e.g. "Uzun Vadeli", "Kısa Vadeli"),
    /// each of which may have nested sub-portfolios (e.g. "Kripto", "BIST Hisseleri").
    /// </summary>
    public class Portfolio
    {
        public int Id { get; set; }

        /// <summary>Owner of this portfolio.</summary>
        public string ApplicationUserId { get; set; }

        /// <summary>
        /// Parent portfolio ID for sub-portfolio hierarchy.
        /// Null for top-level portfolios.
        /// </summary>
        public int? ParentPortfolioId { get; set; }

        /// <summary>Display name (e.g. "Ana Portföy", "Kripto Cüzdanı").</summary>
        public string Name { get; set; }

        public string Description { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAtUtc { get; set; }

        // ── Navigation Properties ────────────────────────────────────────────
        public Portfolio ParentPortfolio { get; set; }
        public ICollection<Portfolio> SubPortfolios { get; set; } = new List<Portfolio>();
        public ICollection<PortfolioAsset> Assets { get; set; } = new List<PortfolioAsset>();
    }
}
