using System;

namespace FinTreX.Core.DTOs.MarketData
{
    public class GoldPriceDto
    {
        public decimal OunceUsd { get; set; }
        public decimal OunceTry { get; set; }
        public decimal GramUsd { get; set; }
        public decimal GramTry { get; set; }
        public string PriceQuality { get; set; } = "EXACT";
        public DateTime UpdatedAt { get; set; }
    }
}
