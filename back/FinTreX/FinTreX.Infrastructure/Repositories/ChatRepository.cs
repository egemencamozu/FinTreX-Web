using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class ChatRepository : IChatRepository
    {
        private readonly ApplicationDbContext _db;

        public ChatRepository(ApplicationDbContext db)
        {
            _db = db;
        }

        // ── Conversation ──────────────────────────────────────────────

        public async Task<Conversation> CreateConversationAsync(Conversation conversation)
        {
            await _db.Conversations.AddAsync(conversation);
            await _db.SaveChangesAsync();
            return conversation;
        }

        public async Task<Conversation> GetConversationByIdAsync(int conversationId)
        {
            return await _db.Conversations
                .Include(c => c.Participants)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == conversationId);
        }

        public async Task<IReadOnlyList<Conversation>> GetConversationsByUserIdAsync(string userId)
        {
            return await _db.ConversationParticipants
                .Where(cp => cp.UserId == userId && !cp.IsDeleted)
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c.Participants)
                .Select(cp => cp.Conversation)
                .OrderByDescending(c => c.LastMessageAtUtc ?? c.CreatedAtUtc)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task UpdateConversationAsync(Conversation conversation)
        {
            var tracked = _db.Conversations.Local.FirstOrDefault(e => e.Id == conversation.Id);
            if (tracked != null)
            {
                _db.Entry(tracked).CurrentValues.SetValues(conversation);
            }
            else
            {
                _db.Conversations.Attach(conversation);
                _db.Entry(conversation).State = EntityState.Modified;
            }
            await _db.SaveChangesAsync();
        }

        // ── Participants ──────────────────────────────────────────────

        public async Task<ConversationParticipant> GetParticipantAsync(int conversationId, string userId)
        {
            return await _db.ConversationParticipants
                .FirstOrDefaultAsync(p => p.ConversationId == conversationId && p.UserId == userId);
        }

        public async Task<IReadOnlyList<ConversationParticipant>> GetParticipantsAsync(int conversationId)
        {
            return await _db.ConversationParticipants
                .Where(p => p.ConversationId == conversationId)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task UpdateParticipantAsync(ConversationParticipant participant)
        {
            var tracked = _db.ConversationParticipants.Local.FirstOrDefault(e => e.Id == participant.Id);
            if (tracked != null)
            {
                // If it's the same instance, do nothing or update properties
                if (!ReferenceEquals(tracked, participant))
                {
                    _db.Entry(tracked).CurrentValues.SetValues(participant);
                }
            }
            else
            {
                _db.ConversationParticipants.Attach(participant);
                _db.Entry(participant).State = EntityState.Modified;
            }
            await _db.SaveChangesAsync();
        }

        // ── Messages ──────────────────────────────────────────────────

        public async Task<ChatMessage> AddMessageAsync(ChatMessage message)
        {
            await _db.ChatMessages.AddAsync(message);
            await _db.SaveChangesAsync();
            return message;
        }

        public async Task<ChatMessage> GetMessageByIdAsync(long messageId)
        {
            return await _db.ChatMessages.FindAsync(messageId);
        }

        public async Task UpdateMessageAsync(ChatMessage message)
        {
            var tracked = _db.ChatMessages.Local.FirstOrDefault(e => e.Id == message.Id);
            if (tracked != null)
            {
                if (!ReferenceEquals(tracked, message))
                {
                    _db.Entry(tracked).CurrentValues.SetValues(message);
                }
            }
            else
            {
                _db.ChatMessages.Attach(message);
                _db.Entry(message).State = EntityState.Modified;
            }
            await _db.SaveChangesAsync();
        }

        public async Task<IReadOnlyList<ChatMessage>> GetMessagesAsync(
            int conversationId, long? beforeId, int pageSize)
        {
            var query = _db.ChatMessages
                .Where(m => m.ConversationId == conversationId);

            if (beforeId.HasValue)
            {
                query = query.Where(m => m.Id < beforeId.Value);
            }

            return await query
                .OrderByDescending(m => m.Id)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<ChatMessage> GetLastMessageAsync(int conversationId)
        {
            return await _db.ChatMessages
                .Where(m => m.ConversationId == conversationId)
                .OrderByDescending(m => m.Id)
                .AsNoTracking()
                .FirstOrDefaultAsync();
        }

        // ── Unread Counts ─────────────────────────────────────────────

        public async Task<int> GetUnreadCountAsync(int conversationId, string userId, long? lastReadMessageId)
        {
            var lastRead = lastReadMessageId ?? 0;
            return await _db.ChatMessages
                .CountAsync(m =>
                    m.ConversationId == conversationId &&
                    m.Id > lastRead &&
                    m.SenderId != userId &&
                    !m.IsDeleted);
        }

        public async Task<int> GetTotalUnreadCountAsync(string userId)
        {
            // Subquery: for each conversation the user participates in,
            // count messages with Id > LastReadMessageId sent by others.
            var participations = await _db.ConversationParticipants
                .Where(p => p.UserId == userId && !p.IsDeleted)
                .Select(p => new { p.ConversationId, p.LastReadMessageId })
                .ToListAsync();

            int total = 0;
            foreach (var p in participations)
            {
                var lastRead = p.LastReadMessageId ?? 0;
                total += await _db.ChatMessages
                    .CountAsync(m =>
                        m.ConversationId == p.ConversationId &&
                        m.Id > lastRead &&
                        m.SenderId != userId &&
                        !m.IsDeleted);
            }

            return total;
        }
    }
}
