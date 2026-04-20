using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.Models.MarketData
{
    public class ForexRate
    {
        public string Pair { get; set; } = "USDTRY";
        public decimal Rate { get; set; }
        public string Source { get; set; } = "YAHOO";
        public ForexQuality Quality { get; set; } = ForexQuality.Primary;
        public DateTime UpdatedAt { get; set; }
    }
}
