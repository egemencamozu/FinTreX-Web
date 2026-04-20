using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IChatRepository
    {
        // ── Conversation ──
        Task<Conversation> CreateConversationAsync(Conversation conversation);
        Task<Conversation> GetConversationByIdAsync(int conversationId);

        /// <summary>Get all conversations where the user is a non-deleted participant.</summary>
        Task<IReadOnlyList<Conversation>> GetConversationsByUserIdAsync(string userId);
        Task UpdateConversationAsync(Conversation conversation);

        // ── Participants ──
        Task<ConversationParticipant> GetParticipantAsync(int conversationId, string userId);
        Task<IReadOnlyList<ConversationParticipant>> GetParticipantsAsync(int conversationId);
        Task UpdateParticipantAsync(ConversationParticipant participant);

        // ── Messages ──
        Task<ChatMessage> AddMessageAsync(ChatMessage message);
        Task<ChatMessage> GetMessageByIdAsync(long messageId);
        Task UpdateMessageAsync(ChatMessage message);

        /// <summary>
        /// Cursor-based pagination: get messages older than the cursor, ordered descending.
        /// </summary>
        Task<IReadOnlyList<ChatMessage>> GetMessagesAsync(
            int conversationId, long? beforeId, int pageSize);

        /// <summary>Get the latest message in a conversation (for list preview).</summary>
        Task<ChatMessage> GetLastMessageAsync(int conversationId);

        // ── Unread Counts ──
        /// <summary>Count messages the user hasn't read in a specific conversation.</summary>
        Task<int> GetUnreadCountAsync(int conversationId, string userId, long? lastReadMessageId);

        /// <summary>Total unread across all conversations for a user.</summary>
        Task<int> GetTotalUnreadCountAsync(string userId);
    }
}
