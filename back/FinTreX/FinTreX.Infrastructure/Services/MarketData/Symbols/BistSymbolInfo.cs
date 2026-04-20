namespace FinTreX.Infrastructure.Services.MarketData.Symbols
{
#nullable enable
    public sealed class BistSymbolInfo
    {
        public string Ticker { get; init; } = string.Empty;
        public string CompanyName { get; init; } = string.Empty;
        public string Sector { get; init; } = string.Empty;
    }
#nullable restore
}
