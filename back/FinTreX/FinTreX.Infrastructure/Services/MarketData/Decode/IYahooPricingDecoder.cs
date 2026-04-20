using FinTreX.Infrastructure.Proto;

namespace FinTreX.Infrastructure.Services.MarketData.Decode
{
    public interface IYahooPricingDecoder
    {
        bool TryDecode(string rawMessage, out PricingData data);
    }
}
