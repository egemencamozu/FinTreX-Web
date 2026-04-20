using System;
using System.Collections.Generic;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A conversation thread between a user and the AI Portfolio Assistant.
    /// Completely independent from <see cref="Conversation"/> which models
    /// user ↔ economist chats.
    /// </summary>
    public class AiConversation
    {
        public int Id { get; set; }

        /// <summary>ApplicationUser ID of the conversation owner.</summary>
        public string UserId { get; set; }

        /// <summary>Auto-generated from the first user message, user-editable later. Null = "Yeni Sohbet".</summary>
        public string? Title { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Denormalized for efficient ORDER BY in conversation list.</summary>
        public DateTime? LastMessageAtUtc { get; set; }

        /// <summary>Soft delete. Deleted conversations are hidden from the user but kept for audit.</summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Concurrency flag. Set to true when a request is in-flight, false when completed/failed.
        /// Prevents two simultaneous requests for the same conversation from interleaving.
        /// </summary>
        public bool IsProcessing { get; set; } = false;

        /// <summary>
        /// UTC timestamp when <see cref="IsProcessing"/> was last set true.
        /// Used for orphan-lock cleanup (e.g. process crashed mid-request).
        /// </summary>
        public DateTime? ProcessingStartedAtUtc { get; set; }

        // ── Navigation ──
        public ICollection<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
    }
}
