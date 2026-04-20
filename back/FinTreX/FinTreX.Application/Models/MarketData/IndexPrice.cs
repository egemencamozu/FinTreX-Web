using System;

namespace FinTreX.Core.Models.MarketData
{
    public class IndexPrice
    {
        public string Ticker { get; set; } = default!;
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
