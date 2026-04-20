using System;

namespace FinTreX.Core.DTOs.MarketData
{
    public class IndexPriceDto
    {
        public string Ticker { get; set; }
        public string Name { get; set; }
        public decimal Price { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
