using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class CreatePortfolioRequest
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public int? ParentPortfolioId { get; set; }
    }
}
