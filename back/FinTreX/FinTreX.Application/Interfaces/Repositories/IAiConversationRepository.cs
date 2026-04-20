using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IAiConversationRepository
    {
        // Conversation CRUD
        Task<AiConversation?> GetByIdAsync(int id, bool includeMessages = false);
        Task<AiConversation?> GetByIdForUserAsync(int id, string userId, bool includeMessages = false);
        Task<IReadOnlyList<AiConversation>> GetByUserIdAsync(string userId, int maxResults = 50);
        Task<AiConversation> CreateAsync(AiConversation conversation);
        Task UpdateAsync(AiConversation conversation);
        Task SoftDeleteAsync(int id);

        // Message operations
        Task<AiChatMessage> AddMessageAsync(AiChatMessage message);
        Task<IReadOnlyList<AiChatMessage>> GetLastMessagesAsync(int conversationId, int count);

        // Concurrency (IsProcessing)
        /// <summary>
        /// Attempts to acquire the processing lock atomically via single-row UPDATE.
        /// Returns true if acquired, false if already held.
        /// </summary>
        Task<bool> TryAcquireProcessingLockAsync(int conversationId);
        Task ReleaseProcessingLockAsync(int conversationId);
    }
}
