using System.Collections.Generic;

namespace FinTreX.Core.DTOs.AiAssistant
{
    public class AiChatResponseDto
    {
        public int ConversationId { get; set; }
        public long MessageId { get; set; }
        public string Message { get; set; }
        public IReadOnlyList<string> ToolsUsed { get; set; } = new List<string>();
        public bool PartialData { get; set; }
        public bool IsSuccessful { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
