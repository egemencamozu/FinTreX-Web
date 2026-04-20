using FinTreX.Core.Enums;
using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.AiAssistant
{
    public class AiChatMessageDto
    {
        public long Id { get; set; }
        public AiMessageRole Role { get; set; }
        public string Content { get; set; }
        public IReadOnlyList<string> ToolsUsed { get; set; } = new List<string>();
        public bool PartialData { get; set; }
        public DateTime SentAtUtc { get; set; }
    }
}
