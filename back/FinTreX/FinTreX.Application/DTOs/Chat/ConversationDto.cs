using System;
using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Chat
{
    public class ConversationDto
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string CreatedByUserId { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? LastMessageAtUtc { get; set; }

        /// <summary>Participants in this conversation with display info.</summary>
        public List<ConversationParticipantDto> Participants { get; set; } = new();

        /// <summary>Preview of the last message (for conversation list).</summary>
        public ChatMessageDto LastMessage { get; set; }

        /// <summary>Unread message count for the requesting user.</summary>
        public int UnreadCount { get; set; }
    }

    public class ConversationParticipantDto
    {
        public string UserId { get; set; }
        public string DisplayName { get; set; }
        public string Role { get; set; } // "User" or "Economist"
        public bool IsOnline { get; set; }
    }
}
