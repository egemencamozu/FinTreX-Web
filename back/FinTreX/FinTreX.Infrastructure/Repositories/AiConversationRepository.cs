using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class AiConversationRepository : IAiConversationRepository
    {
        private readonly ApplicationDbContext _db;

        public AiConversationRepository(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<AiConversation?> GetByIdAsync(int id, bool includeMessages = false)
        {
            var query = _db.AiConversations.AsQueryable();
            if (includeMessages)
                query = query.Include(c => c.Messages.OrderBy(m => m.SentAtUtc));
            return await query.FirstOrDefaultAsync(c => c.Id == id && c.IsActive);
        }

        public async Task<AiConversation?> GetByIdForUserAsync(int id, string userId, bool includeMessages = false)
        {
            var query = _db.AiConversations.AsQueryable();
            if (includeMessages)
                query = query.Include(c => c.Messages.OrderBy(m => m.SentAtUtc));
            return await query.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId && c.IsActive);
        }

        public async Task<IReadOnlyList<AiConversation>> GetByUserIdAsync(string userId, int maxResults = 50)
        {
            return await _db.AiConversations
                .Where(c => c.UserId == userId && c.IsActive)
                .OrderByDescending(c => c.LastMessageAtUtc ?? c.CreatedAtUtc)
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<AiConversation> CreateAsync(AiConversation conversation)
        {
            _db.AiConversations.Add(conversation);
            await _db.SaveChangesAsync();
            return conversation;
        }

        public async Task UpdateAsync(AiConversation conversation)
        {
            _db.AiConversations.Update(conversation);
            await _db.SaveChangesAsync();
        }

        public async Task SoftDeleteAsync(int id)
        {
            var conv = await _db.AiConversations.FirstOrDefaultAsync(c => c.Id == id);
            if (conv is null) return;
            conv.IsActive = false;
            await _db.SaveChangesAsync();
        }

        public async Task<AiChatMessage> AddMessageAsync(AiChatMessage message)
        {
            _db.AiChatMessages.Add(message);

            // Denormalize: LastMessageAtUtc update
            var conv = await _db.AiConversations.FirstOrDefaultAsync(c => c.Id == message.AiConversationId);
            if (conv is not null)
            {
                conv.LastMessageAtUtc = message.SentAtUtc;
            }

            await _db.SaveChangesAsync();
            return message;
        }

        public async Task<IReadOnlyList<AiChatMessage>> GetLastMessagesAsync(int conversationId, int count)
        {
            // Last N in chronological order → take last N by SentAtUtc desc, then reverse
            var messages = await _db.AiChatMessages
                .Where(m => m.AiConversationId == conversationId)
                .OrderByDescending(m => m.SentAtUtc)
                .Take(count)
                .AsNoTracking()
                .ToListAsync();

            messages.Reverse();
            return messages;
        }

        public async Task<bool> TryAcquireProcessingLockAsync(int conversationId)
        {
            // Atomic: UPDATE ... SET IsProcessing = true WHERE Id = @id AND IsProcessing = false
            // ExecuteUpdateAsync returns affected row count. 1 = acquired, 0 = already held.
            var now = DateTime.UtcNow;
            var affected = await _db.AiConversations
                .Where(c => c.Id == conversationId && !c.IsProcessing)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.IsProcessing, true)
                    .SetProperty(c => c.ProcessingStartedAtUtc, now));
            return affected == 1;
        }

        public async Task ReleaseProcessingLockAsync(int conversationId)
        {
            await _db.AiConversations
                .Where(c => c.Id == conversationId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.IsProcessing, false)
                    .SetProperty(c => c.ProcessingStartedAtUtc, (DateTime?)null));
        }
    }
}
