using FinTreX.Core.DTOs.Chat;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IChatService
    {
        // ── Conversations ──
        Task<ConversationDto> CreateConversationAsync(CreateConversationRequest request, string? userId = null);
        Task<IReadOnlyList<ConversationDto>> GetMyConversationsAsync(string? userId = null);
        Task<ConversationDto> GetConversationAsync(int conversationId, string? userId = null);
        Task DeleteConversationAsync(int conversationId, string? userId = null);
        Task UpdateConversationTitleAsync(int conversationId, string title, string? userId = null);

        // ── Messages ──
        Task<ChatMessageDto> SendMessageAsync(int conversationId, string content, string? userId = null);
        Task<ChatMessageDto> EditMessageAsync(long messageId, string newContent, string? userId = null);
        Task<ChatMessageDto> DeleteMessageAsync(long messageId, string? userId = null);
        Task<CursorPagedResult<ChatMessageDto>> GetMessagesAsync(int conversationId, long? beforeId, int pageSize = 30, string? userId = null);

        // ── Read tracking ──
        Task MarkAsReadAsync(int conversationId, long lastReadMessageId, string? userId = null);
        Task<int> GetTotalUnreadCountAsync(string? userId = null);
        Task<int> GetTotalUnreadCountForUserAsync(string userId);


        // ── Validation helpers ──
        Task<bool> IsParticipantAsync(int conversationId, string userId);
    }
}
