using System;

namespace FinTreX.Core.DTOs.AiAssistant
{
    /// <summary>Lightweight DTO for sidebar conversation list — no message bodies.</summary>
    public class AiConversationListItemDto
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? LastMessageAtUtc { get; set; }
        public string? LastMessagePreview { get; set; } // İlk 100 karakter
    }
}
