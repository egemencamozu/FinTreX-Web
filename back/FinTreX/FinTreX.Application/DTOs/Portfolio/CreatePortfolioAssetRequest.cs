using System;
using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class CreatePortfolioAssetRequest
    {
        [Required]
        [MaxLength(20)]
        public string Symbol { get; set; }

        [Required]
        [MaxLength(100)]
        public string AssetName { get; set; }

        [Required]
        public AssetType AssetType { get; set; }

        [Required]
        [Range(0.000001, double.MaxValue)]
        public decimal Quantity { get; set; }

        [Required]
        [Range(0, double.MaxValue)]
        public decimal AverageCost { get; set; }

        [Required]
        [MaxLength(8)]
        public string Currency { get; set; }

        public DateTime AcquiredAtUtc { get; set; } = DateTime.UtcNow;

        [MaxLength(500)]
        public string? Notes { get; set; }
    }
}
