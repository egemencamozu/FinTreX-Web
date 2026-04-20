using System;

namespace FinTreX.Infrastructure.Models
{
    /// <summary>
    /// Represents a refresh token associated with an ApplicationUser.
    /// Stored in the database to enable token rotation and revocation.
    /// </summary>
    public class RefreshToken
    {
        public int Id { get; set; }
        public string Token { get; set; }
        public DateTime Expires { get; set; }
        public DateTime Created { get; set; }
        public string CreatedByIp { get; set; }
        public DateTime? Revoked { get; set; }
        public string? RevokedByIp { get; set; }
        public string? ReplacedByToken { get; set; }

        /// <summary>Token is active if not expired and not revoked.</summary>
        public bool IsActive => !IsExpired && !IsRevoked;

        /// <summary>Token has passed its expiry date.</summary>
        public bool IsExpired => DateTime.UtcNow >= Expires;

        /// <summary>Token was explicitly revoked.</summary>
        public bool IsRevoked => Revoked != null;
    }
}
