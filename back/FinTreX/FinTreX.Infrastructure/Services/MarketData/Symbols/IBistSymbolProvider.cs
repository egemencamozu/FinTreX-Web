using System.Collections.Generic;

namespace FinTreX.Infrastructure.Services.MarketData.Symbols
{
#nullable enable
    public interface IBistSymbolProvider
    {
        IReadOnlyCollection<string> GetSymbols();
        BistSymbolInfo? GetSymbolInfo(string ticker);
    }
#nullable restore
}
