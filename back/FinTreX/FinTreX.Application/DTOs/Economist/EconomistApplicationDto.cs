using FinTreX.Core.Enums;
using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Economist
{
    public class EconomistApplicationDto
    {
        public int Id { get; set; }
        public string ApplicantUserId { get; set; }
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string Biography { get; set; }
        public int YearsOfExperience { get; set; }
        public string Education { get; set; }
        public string? CurrentTitle { get; set; }
        public string? Institution { get; set; }
        public List<ExpertiseArea> ExpertiseAreas { get; set; }
        public List<string> LicensesAndCertificates { get; set; }
        public List<EconomistApplicationLinkDto> Links { get; set; }
        public EconomistStatus Status { get; set; }
        public string? AdminDecisionNote { get; set; }
        public DateTime SubmittedAtUtc { get; set; }
        public DateTime? ReviewedAtUtc { get; set; }
    }
}
