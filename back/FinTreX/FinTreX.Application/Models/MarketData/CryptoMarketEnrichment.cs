using System;

namespace FinTreX.Core.Models.MarketData
{
    public sealed class CryptoMarketEnrichment
    {
        public decimal? MarketCapUsdt { get; init; }
        public decimal? CirculatingSupply { get; init; }
        public decimal? TotalSupply { get; init; }
        public string? Network { get; init; }
        public DateTime UpdatedAtUtc { get; init; }
    }
}
