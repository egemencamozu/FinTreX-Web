using FinTreX.Core.Enums;
using System;
using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class CreatePortfolioTransactionRequest
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
        public TransactionType Type { get; set; }

        [Required]
        [Range(0.000001, double.MaxValue)]
        public decimal Quantity { get; set; }

        [Required]
        [Range(0, double.MaxValue)]
        public decimal Price { get; set; }

        [Required]
        [MaxLength(8)]
        public string Currency { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? Fees { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime ExecutedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
