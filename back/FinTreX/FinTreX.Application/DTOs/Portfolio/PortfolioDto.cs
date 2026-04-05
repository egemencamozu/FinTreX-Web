using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Portfolio
{
    public class PortfolioDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public int? ParentPortfolioId { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public List<PortfolioAssetDto> Assets { get; set; } = new();
        public List<PortfolioDto> SubPortfolios { get; set; } = new();
    }
}
