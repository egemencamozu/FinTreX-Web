using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Economist
{
    public class EconomistApplicationSubmittedEventDto
    {
        public int ApplicationId { get; set; }
        public string ApplicantUserId { get; set; }
        public string ApplicantName { get; set; }
    }

    public class EconomistApplicationDecisionEventDto
    {
        public int ApplicationId { get; set; }
        public EconomistStatus Decision { get; set; }
        public string? Note { get; set; }
    }
}
