using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class PortfolioHistoryDto
    {
        public string Interval { get; set; } = "30d";
        public string Currency { get; set; } = "TRY";
        public DateTime StartUtc { get; set; }
        public DateTime EndUtc { get; set; }
        public List<string> Labels { get; set; } = new();
        public List<decimal> Values { get; set; } = new();
    }
}