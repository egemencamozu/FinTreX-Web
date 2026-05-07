using FinTreX.Core.DTOs.Chat;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Core.Services
{
    public class ChatService : IChatService
    {
        private readonly IChatRepository _chatRepo;
        private readonly IEconomistClientRepository _econClientRepo;
        private readonly ICurrentUserService _currentUser;

        public ChatService(
            IChatRepository chatRepo,
            IEconomistClientRepository econClientRepo,
            ICurrentUserService currentUser)
        {
            _chatRepo = chatRepo;
            _econClientRepo = econClientRepo;
            _currentUser = currentUser;
        }

        private string ResolveUserId(string? userId) => userId ?? _currentUser.UserId;

        // ── Conversations ─────────────────────────────────────────────

        public async Task<ConversationDto> CreateConversationAsync(CreateConversationRequest request, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);

            // Validate: user can only create chats, not economists
            // Note: If we pass userId explicitly, we assume caller handled role checks or we use _currentUser
            if (userId == null && _currentUser.IsEconomist)
                throw new UnauthorizedAccessException("Sadece kullanıcılar yeni sohbet başlatabilir.");

            // Validate: economist must be assigned to this user
            var isAssigned = await _econClientRepo.IsClientAssignedAsync(request.EconomistId, activeUserId);
            if (!isAssigned)
                throw new InvalidOperationException("Bu ekonomist size atanmamış. Sadece atanmış ekonomistinizle sohbet başlatabilirsiniz.");

            var conversation = new Conversation
            {
                CreatedByUserId = activeUserId,
                Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
                CreatedAtUtc = DateTime.UtcNow,
            };

            if (!string.IsNullOrWhiteSpace(request.InitialMessage))
            {
                conversation.LastMessageAtUtc = DateTime.UtcNow;
            }

            var created = await _chatRepo.CreateConversationAsync(conversation);

            var userParticipant = new ConversationParticipant
            {
                ConversationId = created.Id,
                UserId = activeUserId,
                Role = ConversationParticipantRole.User,
                JoinedAtUtc = DateTime.UtcNow
            };
            var economistParticipant = new ConversationParticipant
            {
                ConversationId = created.Id,
                UserId = request.EconomistId,
                Role = ConversationParticipantRole.Economist,
                JoinedAtUtc = DateTime.UtcNow
            };

            created.Participants.Add(userParticipant);
            created.Participants.Add(economistParticipant);
            await _chatRepo.UpdateConversationAsync(created);

            if (!string.IsNullOrWhiteSpace(request.InitialMessage))
            {
                var message = new ChatMessage
                {
                    ConversationId = created.Id,
                    SenderId = activeUserId,
                    MessageType = MessageType.Text,
                    Content = request.InitialMessage.Trim(),
                    SentAtUtc = DateTime.UtcNow
                };
                await _chatRepo.AddMessageAsync(message);
            }

            return await GetConversationAsync(created.Id, activeUserId);
        }

        public async Task<IReadOnlyList<ConversationDto>> GetMyConversationsAsync(string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var conversations = await _chatRepo.GetConversationsByUserIdAsync(activeUserId);
            var result = new List<ConversationDto>();

            foreach (var conv in conversations)
            {
                var dto = await MapConversationToDto(conv, activeUserId);
                result.Add(dto);
            }

            return result;
        }

        public async Task<ConversationDto> GetConversationAsync(int conversationId, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var conv = await _chatRepo.GetConversationByIdAsync(conversationId);
            if (conv == null)
                throw new KeyNotFoundException("Sohbet bulunamadı.");

            var participant = conv.Participants?.FirstOrDefault(p => p.UserId == activeUserId);
            if (participant == null || participant.IsDeleted)
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");

            return await MapConversationToDto(conv, activeUserId);
        }

        public async Task DeleteConversationAsync(int conversationId, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var participant = await _chatRepo.GetParticipantAsync(conversationId, activeUserId);
            if (participant == null)
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");

            participant.IsDeleted = true;
            participant.DeletedAtUtc = DateTime.UtcNow;
            await _chatRepo.UpdateParticipantAsync(participant);
        }

        public async Task UpdateConversationTitleAsync(int conversationId, string title, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var conv = await _chatRepo.GetConversationByIdAsync(conversationId);
            if (conv == null)
                throw new KeyNotFoundException("Sohbet bulunamadı.");

            var participant = conv.Participants?.FirstOrDefault(p => p.UserId == activeUserId);
            if (participant == null)
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");

            conv.Title = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
            await _chatRepo.UpdateConversationAsync(conv);
        }

        // ── Messages ──────────────────────────────────────────────────

        public async Task<ChatMessageDto> SendMessageAsync(int conversationId, string content, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var participant = await _chatRepo.GetParticipantAsync(conversationId, activeUserId);
            
            if (participant == null || participant.IsDeleted)
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");

            // Verify active assignment if it's a 1-on-1 chat between user and economist
            var otherParticipant = (await _chatRepo.GetParticipantsAsync(conversationId))
                .FirstOrDefault(p => p.UserId != activeUserId);
            
            if (otherParticipant != null)
            {
                var isAssigned1 = await _econClientRepo.IsClientAssignedAsync(otherParticipant.UserId, activeUserId);
                var isAssigned2 = await _econClientRepo.IsClientAssignedAsync(activeUserId, otherParticipant.UserId);

                if (!isAssigned1 && !isAssigned2)
                {
                    throw new InvalidOperationException("Aktif bir ekonomist atamanız bulunmadığı için mesaj gönderemezsiniz.");
                }
            }

            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("Mesaj içeriği boş olamaz.");

            if (content.Length > 4000)
                throw new ArgumentException("Mesaj 4000 karakterden uzun olamaz.");

            var message = new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = activeUserId,
                MessageType = MessageType.Text,
                Content = content.Trim(),
                SentAtUtc = DateTime.UtcNow
            };

            var saved = await _chatRepo.AddMessageAsync(message);

            var conv = await _chatRepo.GetConversationByIdAsync(conversationId);
            if (conv != null)
            {
                conv.LastMessageAtUtc = saved.SentAtUtc;
                await _chatRepo.UpdateConversationAsync(conv);
            }

            participant.LastReadMessageId = saved.Id;
            await _chatRepo.UpdateParticipantAsync(participant);

            return MapMessageToDto(saved, null);
        }

        public async Task<ChatMessageDto> EditMessageAsync(long messageId, string newContent, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var message = await _chatRepo.GetMessageByIdAsync(messageId);

            if (message == null)
                throw new KeyNotFoundException("Mesaj bulunamadı.");
            if (message.SenderId != activeUserId)
                throw new UnauthorizedAccessException("Sadece kendi mesajlarınızı düzenleyebilirsiniz.");
            if (message.IsDeleted)
                throw new InvalidOperationException("Silinmiş mesaj düzenlenemez.");
            if (string.IsNullOrWhiteSpace(newContent))
                throw new ArgumentException("Mesaj içeriği boş olamaz.");

            message.Content = newContent.Trim();
            message.EditedAtUtc = DateTime.UtcNow;
            await _chatRepo.UpdateMessageAsync(message);

            return MapMessageToDto(message, null);
        }

        public async Task<ChatMessageDto> DeleteMessageAsync(long messageId, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var message = await _chatRepo.GetMessageByIdAsync(messageId);

            if (message == null)
                throw new KeyNotFoundException("Mesaj bulunamadı.");
            if (message.SenderId != activeUserId)
                throw new UnauthorizedAccessException("Sadece kendi mesajlarınızı silebilirsiniz.");

            message.IsDeleted = true;
            message.Content = "";
            await _chatRepo.UpdateMessageAsync(message);

            return MapMessageToDto(message, null);
        }

        public async Task<CursorPagedResult<ChatMessageDto>> GetMessagesAsync(
            int conversationId, long? beforeId, int pageSize = 30, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            await EnsureParticipantAsync(conversationId, activeUserId);

            if (pageSize < 1) pageSize = 1;
            if (pageSize > 100) pageSize = 100;

            var messages = await _chatRepo.GetMessagesAsync(conversationId, beforeId, pageSize + 1);
            var hasMore = messages.Count > pageSize;
            var items = messages.Take(pageSize).ToList();

            return new CursorPagedResult<ChatMessageDto>
            {
                Items = items.Select(m => MapMessageToDto(m, null)).ToList(),
                NextCursor = hasMore && items.Any() ? items.Last().Id : null,
                HasMore = hasMore
            };
        }

        // ── Read Tracking ─────────────────────────────────────────────

        public async Task MarkAsReadAsync(int conversationId, long lastReadMessageId, string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            var participant = await _chatRepo.GetParticipantAsync(conversationId, activeUserId);
            if (participant == null) return;

            if (!participant.LastReadMessageId.HasValue || participant.LastReadMessageId < lastReadMessageId)
            {
                participant.LastReadMessageId = lastReadMessageId;
                await _chatRepo.UpdateParticipantAsync(participant);
            }
        }

        public async Task<int> GetTotalUnreadCountAsync(string? userId = null)
        {
            var activeUserId = ResolveUserId(userId);
            return await _chatRepo.GetTotalUnreadCountAsync(activeUserId);
        }

        public async Task<int> GetTotalUnreadCountForUserAsync(string userId)
        {
            return await _chatRepo.GetTotalUnreadCountAsync(userId);
        }

        // ── Validation ────────────────────────────────────────────────

        public async Task<bool> IsParticipantAsync(int conversationId, string userId)
        {
            var participant = await _chatRepo.GetParticipantAsync(conversationId, userId);
            return participant != null && !participant.IsDeleted;
        }

        // ── Private Helpers ───────────────────────────────────────────

        private async Task EnsureParticipantAsync(int conversationId, string userId)
        {
            if (!await IsParticipantAsync(conversationId, userId))
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");
        }

        private async Task<ConversationDto> MapConversationToDto(Conversation conv, string currentUserId)
        {
            var lastMessage = await _chatRepo.GetLastMessageAsync(conv.Id);
            var currentParticipant = conv.Participants?.FirstOrDefault(p => p.UserId == currentUserId);

            var unreadCount = currentParticipant != null
                ? await _chatRepo.GetUnreadCountAsync(conv.Id, currentUserId, currentParticipant.LastReadMessageId)
                : 0;

            var otherParticipant = conv.Participants?.FirstOrDefault(p => p.UserId != currentUserId);
            bool isReadOnly = false;
            if (otherParticipant != null)
            {
                var isAssigned1 = await _econClientRepo.IsClientAssignedAsync(otherParticipant.UserId, currentUserId);
                var isAssigned2 = await _econClientRepo.IsClientAssignedAsync(currentUserId, otherParticipant.UserId);
                isReadOnly = !isAssigned1 && !isAssigned2;
            }

            return new ConversationDto
            {
                Id = conv.Id,
                Title = conv.Title,
                CreatedByUserId = conv.CreatedByUserId,
                CreatedAtUtc = conv.CreatedAtUtc,
                LastMessageAtUtc = conv.LastMessageAtUtc,
                Participants = conv.Participants?.Select(p => new ConversationParticipantDto
                {
                    UserId = p.UserId,
                    DisplayName = "", // Will be enriched by controller
                    Role = p.Role.ToString(),
                    IsOnline = false
                }).ToList() ?? new(),
                LastMessage = lastMessage != null ? MapMessageToDto(lastMessage, null) : null,
                UnreadCount = unreadCount,
                IsReadOnly = isReadOnly
            };
        }

        private static ChatMessageDto MapMessageToDto(ChatMessage msg, string? senderName)
        {
            return new ChatMessageDto
            {
                Id = msg.Id,
                ConversationId = msg.ConversationId,
                SenderId = msg.SenderId,
                SenderName = senderName ?? "",
                MessageType = msg.MessageType.ToString(),
                Content = msg.IsDeleted ? "" : msg.Content,
                SentAtUtc = msg.SentAtUtc,
                EditedAtUtc = msg.EditedAtUtc,
                IsDeleted = msg.IsDeleted
            };
        }
    }
}
