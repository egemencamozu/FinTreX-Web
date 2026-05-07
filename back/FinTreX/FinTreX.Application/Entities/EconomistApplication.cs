using FinTreX.Core.Enums;
using System;
using System.Collections.Generic;

namespace FinTreX.Core.Entities
{
    public class EconomistApplication
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

        /// <summary>Stored as JSON array in DB.</summary>
        public List<ExpertiseArea> ExpertiseAreas { get; set; } = new();

        /// <summary>Stored as JSON array in DB.</summary>
        public List<string> LicensesAndCertificates { get; set; } = new();

        public List<EconomistApplicationLink> Links { get; set; } = new();


        public EconomistStatus Status { get; set; } = EconomistStatus.Pending;
        public string? AdminDecisionNote { get; set; }
        public string? ReviewedByAdminId { get; set; }

        public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAtUtc { get; set; }
    }
}
