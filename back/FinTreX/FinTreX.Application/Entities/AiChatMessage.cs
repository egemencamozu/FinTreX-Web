using FinTreX.Core.Enums;
using System;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// A single message in an <see cref="AiConversation"/>.
    /// Long Id because each conversation can accumulate many messages.
    /// </summary>
    public class AiChatMessage
    {
        public long Id { get; set; }

        public int AiConversationId { get; set; }

        public AiMessageRole Role { get; set; }

        /// <summary>Raw message content. Max 4000 chars enforced at API layer.</summary>
        public string Content { get; set; }

        /// <summary>
        /// JSON array of tool names the AI used to produce this message (for transparency/debugging).
        /// Null for User messages.
        /// Example: ["get_user_portfolios","get_stock_prices"]
        /// </summary>
        public string? ToolsUsed { get; set; }

        /// <summary>
        /// True when at least one tool call failed but the assistant produced a (partial) response anyway.
        /// UI can show a subtle "Bazı veriler alınamadı" badge.
        /// </summary>
        public bool PartialData { get; set; } = false;

        public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;

        // ── Navigation ──
        public AiConversation AiConversation { get; set; }
    }
}
