using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class UpdatePortfolioAssetRequest
    {
        [Range(0.000001, double.MaxValue)]
        public decimal? Quantity { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? AverageCost { get; set; }

        [MaxLength(500)]
        public string Notes { get; set; }
    }
}
