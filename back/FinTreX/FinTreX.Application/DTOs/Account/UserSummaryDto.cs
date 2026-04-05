using System;

namespace FinTreX.Core.DTOs.Account
{
    /// <summary>
    /// Lightweight user projection used by admin user-management screens.
    /// </summary>
    public class UserSummaryDto
    {
        public string Id { get; set; }
        public string UserName { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; }
        public bool EmailConfirmed { get; set; }
        public string Role { get; set; }
        public bool IsActive { get; set; }
        public DateTimeOffset? DeactivatedUntil { get; set; }
    }
}
