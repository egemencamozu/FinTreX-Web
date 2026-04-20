using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A single message within a conversation.
    /// Uses long Id for high-volume scalability.
    /// </summary>
    public class ChatMessage
    {
        public long Id { get; set; }

        public int ConversationId { get; set; }

        /// <summary>ApplicationUser ID of the sender.</summary>
        public string SenderId { get; set; }

        public MessageType MessageType { get; set; } = MessageType.Text;

        /// <summary>Message body. Max 4000 chars for text. JSON for future media types.</summary>
        public string Content { get; set; }

        public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Non-null indicates the message was edited. Shows "(düzenlendi)" in UI.</summary>
        public DateTime? EditedAtUtc { get; set; }

        /// <summary>Soft-delete — shows "Bu mesaj silindi" in UI instead of content.</summary>
        public bool IsDeleted { get; set; } = false;

        // ── Navigation ──
        public Conversation Conversation { get; set; }
    }
}
