using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.AiAssistant
{
    /// <summary>Full conversation with all messages (for opening a conversation).</summary>
    public class AiConversationDto
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? LastMessageAtUtc { get; set; }
        public IReadOnlyList<AiChatMessageDto> Messages { get; set; } = new List<AiChatMessageDto>();
    }
}
