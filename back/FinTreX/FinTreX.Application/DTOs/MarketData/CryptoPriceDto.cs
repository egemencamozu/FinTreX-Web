using System;

namespace FinTreX.Core.DTOs.MarketData
{
    public class CryptoPriceDto
    {
        public string Symbol { get; set; } = default!;
        public string BaseAsset { get; set; } = default!;
        public decimal PriceUsdt { get; set; }
        public decimal PriceTry { get; set; }
        public decimal? ChangePercent1h { get; set; }
        public decimal? ChangePercent4h { get; set; }
        public decimal ChangePercent24h { get; set; }
        public decimal? MarketCapUsdt { get; set; }
        public decimal? CirculatingSupply { get; set; }
        public decimal? TotalSupply { get; set; }
        public string? Network { get; set; }
        public decimal Volume24h { get; set; }
        public string TrySource { get; set; } = "CALCULATED";
        public DateTime UpdatedAt { get; set; }
    }
}
