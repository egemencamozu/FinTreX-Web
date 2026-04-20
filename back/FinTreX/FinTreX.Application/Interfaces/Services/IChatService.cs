using FinTreX.Core.DTOs.Chat;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IChatService
    {
        // ── Conversations ──
        Task<ConversationDto> CreateConversationAsync(CreateConversationRequest request);
        Task<IReadOnlyList<ConversationDto>> GetMyConversationsAsync();
        Task<ConversationDto> GetConversationAsync(int conversationId);
        Task DeleteConversationAsync(int conversationId);
        Task UpdateConversationTitleAsync(int conversationId, string title);

        // ── Messages ──
        Task<ChatMessageDto> SendMessageAsync(int conversationId, string content);
        Task<ChatMessageDto> EditMessageAsync(long messageId, string newContent);
        Task<ChatMessageDto> DeleteMessageAsync(long messageId);
        Task<CursorPagedResult<ChatMessageDto>> GetMessagesAsync(int conversationId, long? beforeId, int pageSize = 30);

        // ── Read tracking ──
        Task MarkAsReadAsync(int conversationId, long lastReadMessageId);
        Task<int> GetTotalUnreadCountAsync();
        Task<int> GetTotalUnreadCountForUserAsync(string userId);


        // ── Validation helpers ──
        Task<bool> IsParticipantAsync(int conversationId, string userId);
    }
}
