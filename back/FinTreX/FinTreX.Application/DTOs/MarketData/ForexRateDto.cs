using System;

namespace FinTreX.Core.DTOs.MarketData
{
    public class ForexRateDto
    {
        public string Pair { get; set; } = "USDTRY";
        public decimal Rate { get; set; }
        public string Source { get; set; } = "YAHOO";
        public string Quality { get; set; } = "PRIMARY";
        public DateTime UpdatedAt { get; set; }
    }
}
