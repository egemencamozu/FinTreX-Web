using System;

namespace FinTreX.Core.DTOs.MarketData
{
    public class StockPriceDto
    {
        public string Ticker { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string Sector { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public long Volume { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
