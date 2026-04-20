using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Join table tracking each participant in a conversation.
    /// Holds per-participant state: last read position, soft-delete, etc.
    /// </summary>
    public class ConversationParticipant
    {
        public int Id { get; set; }

        public int ConversationId { get; set; }

        /// <summary>ApplicationUser ID (could be User or Economist).</summary>
        public string UserId { get; set; }

        public ConversationParticipantRole Role { get; set; }

        public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// The Id of the last ChatMessage this participant has read.
        /// Null = no messages read yet. Used to calculate unread count efficiently.
        /// Unread = COUNT(messages WHERE Id > LastReadMessageId AND SenderId != UserId)
        /// </summary>
        public long? LastReadMessageId { get; set; }

        /// <summary>Per-participant soft delete — the other party still sees the chat.</summary>
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAtUtc { get; set; }

        // ── Navigation ──
        public Conversation Conversation { get; set; }
    }
}
