using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Account
{
    public class BulkOperationResultDto
    {
        public int SuccessCount { get; set; }
        public int FailedCount { get; set; }
        public List<string> FailedUserIds { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }
}
