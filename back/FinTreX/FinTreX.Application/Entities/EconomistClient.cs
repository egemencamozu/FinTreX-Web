using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Many-to-many assignment between Economists and their Clients (Users).
    /// Enforced by subscription limits: Default=1, Premium=3, Ultra=unlimited.
    /// </summary>
    public class EconomistClient
    {
        public int Id { get; set; }

        /// <summary>The economist's ApplicationUser ID.</summary>
        public string EconomistId { get; set; }

        /// <summary>The client's (standard user) ApplicationUser ID.</summary>
        public string ClientId { get; set; }

        public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Soft-delete flag — inactive assignments are kept for history.</summary>
        public bool IsActive { get; set; } = true;

        /// <summary>Optional note from admin or user about the assignment.</summary>
        public string? Notes { get; set; }
    }
}
