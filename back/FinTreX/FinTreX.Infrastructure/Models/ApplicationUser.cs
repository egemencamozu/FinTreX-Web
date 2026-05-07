using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;

namespace FinTreX.Infrastructure.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }

        /// <summary>Tracks the economist's approval lifecycle. None for non-economist accounts.</summary>
        public EconomistStatus EconomistStatus { get; set; } = EconomistStatus.None;

        // ── Profile Timestamps ───────────────────────────────────────────────
        /// <summary>UTC timestamp when the account was created.</summary>
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        /// <summary>UTC timestamp of the user's last successful sign-in. Null if never signed in.</summary>
        public DateTimeOffset? LastLoginAt { get; set; }

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
