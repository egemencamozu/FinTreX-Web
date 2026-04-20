using FinTreX.Core.DTOs.Chat;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Hubs
{
    /// <summary>
    /// Strongly-typed SignalR client interface for chat events.
    /// </summary>
    public interface IChatClient
    {
        // ── Messages ──
        Task ReceiveMessage(ChatMessageDto message);
        Task MessageEdited(long messageId, string newContent, System.DateTime editedAtUtc);
        Task MessageDeleted(long messageId);

        // ── Read tracking ──
        Task MessagesRead(int conversationId, long lastReadMessageId, System.DateTime readAtUtc);

        // ── Typing ──
        Task UserTyping(int conversationId, string userId, string displayName);

        // ── Presence ──
        Task UserOnline(string userId);
        Task UserOffline(string userId);

        // ── Conversation lifecycle ──
        Task ConversationCreated(ConversationDto conversation);
        Task ConversationDeleted(int conversationId);

        // ── Unread badge ──
        Task UnreadCountUpdated(int totalUnreadCount);
    }
}
