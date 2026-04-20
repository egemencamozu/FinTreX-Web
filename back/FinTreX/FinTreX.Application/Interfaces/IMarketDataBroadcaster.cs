using FinTreX.Core.DTOs.MarketData;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    public interface IMarketDataBroadcaster
    {
        Task BroadcastGoldUpdate(GoldPriceDto dto);
        Task BroadcastStockUpdate(StockPriceDto dto);
        Task BroadcastIndexUpdate(IndexPriceDto dto);
        Task BroadcastCryptoUpdate(CryptoPriceDto dto);
        Task BroadcastForexUpdate(ForexRateDto dto);
        Task BroadcastToGroup(string groupName, string method, object data);
    }
}
