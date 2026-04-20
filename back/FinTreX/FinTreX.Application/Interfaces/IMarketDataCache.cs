using FinTreX.Core.Models.MarketData;
using System.Collections.Generic;

#nullable enable
namespace FinTreX.Core.Interfaces
{
    public interface IMarketDataCache
    {
        GoldPrice? GetGold(string symbol);
        void SetGold(string symbol, GoldPrice price);
        IReadOnlyList<GoldPrice> GetAllGold();
        IReadOnlyList<GoldPrice> GetAllGoldNoTouch();

        StockPrice? GetStock(string ticker);
        void SetStock(string ticker, StockPrice price);
        IReadOnlyList<StockPrice> GetAllStocks();

        IndexPrice? GetIndex(string ticker);
        void SetIndex(string ticker, IndexPrice price);
        IReadOnlyList<IndexPrice> GetAllIndices();

        CryptoCurrency? GetCrypto(string symbol);
        void SetCrypto(string symbol, CryptoCurrency price);
        IReadOnlyList<CryptoCurrency> GetAllCrypto();
        IReadOnlyList<CryptoCurrency> GetAllCryptoNoTouch();
        int GetExpectedCryptoSymbolCount();
        void SetExpectedCryptoSymbolCount(int count);

        ForexRate? GetForex(string pair);
        void SetForex(string pair, ForexRate rate);
        decimal GetUsdTry();

    }
}
#nullable restore
