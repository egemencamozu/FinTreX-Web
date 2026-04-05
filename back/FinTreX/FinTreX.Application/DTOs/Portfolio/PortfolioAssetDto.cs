using System;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class PortfolioAssetDto
    {
        public int Id { get; set; }
        public int PortfolioId { get; set; }
        public string Symbol { get; set; }
        public string AssetName { get; set; }
        public AssetType AssetType { get; set; }
        public decimal Quantity { get; set; }
        public decimal AverageCost { get; set; }
        public string Currency { get; set; }
        public decimal? CurrentValue { get; set; }
        public DateTime? CurrentValueUpdatedAtUtc { get; set; }
        public DateTime AcquiredAtUtc { get; set; }
        public string Notes { get; set; }
    }
}
