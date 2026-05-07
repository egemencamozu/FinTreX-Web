using FinTreX.Core.Enums;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Economist
{
    public class SubmitEconomistApplicationRequest
    {
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string Biography { get; set; }
        public int YearsOfExperience { get; set; }
        public string Education { get; set; }
        public string? CurrentTitle { get; set; }
        public string? Institution { get; set; }
        public List<ExpertiseArea> ExpertiseAreas { get; set; } = new();
        public List<string> LicensesAndCertificates { get; set; } = new();
        public List<EconomistApplicationLinkRequest> Links { get; set; } = new();
    }
}
