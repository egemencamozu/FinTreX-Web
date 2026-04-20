using System;
using System.Collections.Generic;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A chat thread between a User and an Economist.
    /// Participants are tracked via the ConversationParticipant join table.
    /// </summary>
    public class Conversation
    {
        public int Id { get; set; }

        /// <summary>The ApplicationUser ID who initiated this conversation.</summary>
        public string CreatedByUserId { get; set; }

        /// <summary>Optional topic/title. Null means "Adsız Sohbet".</summary>
        public string Title { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Denormalized timestamp of the last message for efficient sorting.</summary>
        public DateTime? LastMessageAtUtc { get; set; }

        // ── Navigation ──
        public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }
}
