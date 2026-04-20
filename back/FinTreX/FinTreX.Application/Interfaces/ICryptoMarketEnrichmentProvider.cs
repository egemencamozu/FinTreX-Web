using FinTreX.Core.Models.MarketData;

namespace FinTreX.Core.Interfaces
{
    public interface ICryptoMarketEnrichmentProvider
    {
        CryptoMarketEnrichment? GetBySymbol(string symbol);
    }
}
