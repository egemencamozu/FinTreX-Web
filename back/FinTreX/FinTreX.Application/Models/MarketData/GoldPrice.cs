using System;

namespace FinTreX.Core.Models.MarketData
{
    public class GoldPrice
    {
        public string Symbol { get; set; } = default!;
        public decimal OunceUsd { get; set; }
        public decimal OunceTry { get; set; }
        public decimal GramUsd { get; set; }
        public decimal GramTry { get; set; }
        public string PriceQuality { get; set; } = "EXACT";
        public DateTime UpdatedAt { get; set; }
    }
}
