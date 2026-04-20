using System;

namespace FinTreX.Core.DTOs.Chat
{
    public class ChatMessageDto
    {
        public long Id { get; set; }
        public int ConversationId { get; set; }
        public string SenderId { get; set; }
        public string SenderName { get; set; }
        public string MessageType { get; set; }
        public string Content { get; set; }
        public DateTime SentAtUtc { get; set; }
        public DateTime? EditedAtUtc { get; set; }
        public bool IsDeleted { get; set; }
    }
}
