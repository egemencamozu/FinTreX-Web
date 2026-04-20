using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Persisted enrichment data for a single crypto symbol (market cap, supply, network).
    /// Used to avoid hitting external APIs on every startup.
    /// </summary>
    public class CryptoEnrichmentSnapshot
    {
        public int Id { get; set; }
        public string Symbol { get; set; } = default!;        // e.g. "BTC"
        public decimal? MarketCapUsdt { get; set; }
        public decimal? CirculatingSupply { get; set; }
        public decimal? TotalSupply { get; set; }
        public string? Network { get; set; }
        public CryptoEnrichmentStatus EnrichmentStatus { get; set; } = CryptoEnrichmentStatus.PendingRetry;
        public DateTime? LastAttemptedAtUtc { get; set; }
        public string? LastProvider { get; set; }
        public DateTime RefreshedAtUtc { get; set; }
    }
}
