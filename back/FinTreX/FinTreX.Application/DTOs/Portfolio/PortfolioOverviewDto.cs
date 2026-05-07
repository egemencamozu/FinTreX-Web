using System;
using System.Collections.Generic;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class PortfolioOverviewDto
    {
        public int PortfolioId { get; set; }
        public string Currency { get; set; } = "TRY";
        public decimal TotalValue { get; set; }
        public decimal TotalCost { get; set; }
        public decimal TotalPnl { get; set; }
        public decimal TotalPnlPercent { get; set; }
        public decimal? UsdTryRate { get; set; }
        public DateTime GeneratedAtUtc { get; set; }
        public List<PortfolioOverviewAllocationDto> Allocations { get; set; } = new();
        public List<PortfolioOverviewAssetPerformanceDto> AssetPerformances { get; set; } = new();
    }

    public class PortfolioOverviewAllocationDto
    {
        public string Label { get; set; } = string.Empty;
        public decimal Value { get; set; }
        public decimal WeightPercent { get; set; }
    }

    public class PortfolioOverviewAssetPerformanceDto
    {
        public string Symbol { get; set; } = string.Empty;
        public AssetType AssetType { get; set; }
        public decimal Value { get; set; }
        public decimal ChangePercent { get; set; }
    }
}
