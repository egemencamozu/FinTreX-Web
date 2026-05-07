namespace FinTreX.Core.DTOs.Economist
{
    public class AdminReviewApplicationRequest
    {
        /// <summary>Approve or Reject</summary>
        public string Decision { get; set; }
        public string? Note { get; set; }
    }
}
