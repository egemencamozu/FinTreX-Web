using System;

namespace FinTreX.Core.DTOs.Account
{
    /// <summary>
    /// Snapshot of a refresh token as a "session" for the active-sessions UI.
    /// Never exposes the raw token value.
    /// </summary>
    public class SessionDto
    {
        public int Id { get; set; }
        public string DeviceName { get; set; }
        public string UserAgent { get; set; }
        public string IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsCurrent { get; set; }
    }
}
