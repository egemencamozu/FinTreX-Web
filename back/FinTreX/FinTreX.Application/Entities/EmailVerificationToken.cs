using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Tracks a 6-digit OTP code issued to a user for email verification.
    /// The raw code is never stored — only a SHA-256 hash.
    /// </summary>
    public class EmailVerificationToken
    {
        public int Id { get; set; }

        /// <summary>FK → AspNet Identity user id.</summary>
        public string ApplicationUserId { get; set; }

        /// <summary>Copied from the user at creation time for audit/lookup.</summary>
        public string Email { get; set; }

        /// <summary>SHA-256 hash of the 6-digit OTP (hex, lower-case).</summary>
        public string CodeHash { get; set; }

        public DateTime ExpiresAt { get; set; }

        public DateTime CreatedAt { get; set; }

        /// <summary>Number of verification attempts. Invalidated once it reaches the configured max.</summary>
        public int AttemptCount { get; set; }

        /// <summary>True once the code has been successfully consumed.</summary>
        public bool IsUsed { get; set; }

        public DateTime? UsedAt { get; set; }
    }
}
