using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class PortfolioTransactionDto
    {
        public int Id { get; set; }
        public int PortfolioId { get; set; }
        public string Symbol { get; set; }
        public string AssetName { get; set; }
        public AssetType AssetType { get; set; }
        public TransactionType Type { get; set; }
        public decimal Quantity { get; set; }
        public decimal Price { get; set; }
        public string Currency { get; set; }
        public decimal? Fees { get; set; }
        public string? Notes { get; set; }
        public DateTime ExecutedAtUtc { get; set; }
        public DateTime CreatedAtUtc { get; set; }
    }
}
