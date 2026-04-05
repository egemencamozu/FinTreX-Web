using FinTreX.Core.Entities;
using Microsoft.AspNetCore.Identity;
using System.Collections.Generic;

namespace FinTreX.Infrastructure.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }

        // ── Auth ─────────────────────────────────────────────────────────────
        /// <summary>Refresh tokens for this user (multi-device support).</summary>
        public List<RefreshToken> RefreshTokens { get; set; } = new();

        // ── Domain Navigation ────────────────────────────────────────────────
        /// <summary>All portfolios owned by this user.</summary>
        public ICollection<Portfolio> Portfolios { get; set; } = new List<Portfolio>();

        /// <summary>User's active subscription (1:1).</summary>
        public UserSubscription Subscription { get; set; }
    }
}
