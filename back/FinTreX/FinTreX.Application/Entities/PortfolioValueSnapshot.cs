using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Immutable point-in-time portfolio valuation snapshot.
    /// History charts are rendered from these persisted points.
    /// </summary>
    public class PortfolioValueSnapshot
    {
        public long Id { get; set; }
        public int PortfolioId { get; set; }
        public DateTime CapturedAtUtc { get; set; }
        public decimal TotalValueTry { get; set; }
        public decimal TotalValueUsd { get; set; }
        public decimal? UsdTryRate { get; set; }

        public Portfolio Portfolio { get; set; } = null!;
    }
}