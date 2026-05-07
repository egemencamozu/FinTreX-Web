using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Economist
{
    public class PagedEconomistApplicationsResult
    {
        public List<EconomistApplicationDto> Items { get; set; }
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
