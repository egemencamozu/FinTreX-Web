using FinTreX.Core.DTOs.Chat;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Hubs
{
    [Authorize]
    public class ChatHub : Hub<IChatClient>
    {
        private readonly IChatService _chatService;
        private readonly IChatConnectionTracker _connectionTracker;
        private readonly UserManager<ApplicationUser> _userManager;

        public ChatHub(
            IChatService chatService,
            IChatConnectionTracker connectionTracker,
            UserManager<ApplicationUser> userManager)
        {
            _chatService = chatService;
            _connectionTracker = connectionTracker;
            _userManager = userManager;
        }

        // ── Connection Lifecycle ──────────────────────────────────────

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            var wasOnline = _connectionTracker.IsOnline(userId);
            _connectionTracker.TrackConnection(userId, Context.ConnectionId);

            if (!wasOnline)
            {
                // Notify all conversation partners that this user came online
                await NotifyPresenceChangeAsync(userId, online: true);
            }

            // Sync total unread count on connect
            var unreadCount = await _chatService.GetTotalUnreadCountAsync(userId);
            await Clients.Caller.UnreadCountUpdated(unreadCount);

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            var userId = GetUserId();
            _connectionTracker.RemoveConnection(userId, Context.ConnectionId);

            if (!_connectionTracker.IsOnline(userId))
            {
                // Last connection dropped — user is now offline
                await NotifyPresenceChangeAsync(userId, online: false);
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ── Hub Methods ───────────────────────────────────────────────

        /// <summary>Join a conversation room to receive real-time messages.</summary>
        public async Task JoinConversation(int conversationId)
        {
            var userId = GetUserId();
            if (!await _chatService.IsParticipantAsync(conversationId, userId))
                throw new HubException("Bu sohbete erişim yetkiniz yok.");

            await Groups.AddToGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));
        }

        /// <summary>Leave a conversation room.</summary>
        public async Task LeaveConversation(int conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));
        }

        /// <summary>Send a text message to a conversation.</summary>
        public async Task<ChatMessageDto> SendMessage(int conversationId, string content)
        {
            try
            {
                var userId = GetUserId();
                // 1. Save message to DB
                var messageDto = await _chatService.SendMessageAsync(conversationId, content, userId);

                // 2. Enrich with sender name (Safe fallback)
                try
                {
                    var sender = await _userManager.FindByIdAsync(messageDto.SenderId);
                    messageDto.SenderName = sender != null
                        ? $"{sender.FirstName} {sender.LastName}".Trim()
                        : "Bilinmeyen";
                }
                catch { messageDto.SenderName = "Bilinmeyen"; }

                // 3. Broadcast to the conversation group immediately
                await Clients.Group(ConversationGroup(conversationId)).ReceiveMessage(messageDto);

                // 4. Update unread counts for others in background
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = Context.GetHttpContext()?.RequestServices.CreateScope();
                        if (scope == null) return;
                        
                        var chatService = scope.ServiceProvider.GetRequiredService<IChatService>();
                        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub, IChatClient>>();

                        var conv = await chatService.GetConversationAsync(conversationId, userId);
                        if (conv?.Participants != null)
                        {
                            foreach (var participant in conv.Participants.Where(p => p.UserId != messageDto.SenderId))
                            {
                                var unreadCount = await chatService.GetTotalUnreadCountForUserAsync(participant.UserId);
                                await hubContext.Clients.User(participant.UserId).UnreadCountUpdated(unreadCount);
                            }
                        }
                    }
                    catch { }
                });

                return messageDto;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ChatHub] SendMessage Error: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                throw new HubException($"Mesaj gönderilirken bir hata oluştu: {ex.Message}");
            }
        }

        /// <summary>Edit an existing message.</summary>
        public async Task EditMessage(long messageId, string newContent)
        {
            var updated = await _chatService.EditMessageAsync(messageId, newContent);
            await Clients.Group(ConversationGroup(updated.ConversationId))
                .MessageEdited(messageId, newContent, updated.EditedAtUtc ?? DateTime.UtcNow);
        }

        /// <summary>Delete a message (soft-delete).</summary>
        public async Task DeleteMessage(long messageId)
        {
            var deleted = await _chatService.DeleteMessageAsync(messageId);
            await Clients.Group(ConversationGroup(deleted.ConversationId))
                .MessageDeleted(messageId);
        }

        /// <summary>Mark messages up to a certain ID as read.</summary>
        public async Task MarkAsRead(int conversationId, long lastReadMessageId)
        {
            var userId = GetUserId();
            await _chatService.MarkAsReadAsync(conversationId, lastReadMessageId, userId);

            // Notify the other participant(s) about read receipt
            await Clients.OthersInGroup(ConversationGroup(conversationId))
                .MessagesRead(conversationId, lastReadMessageId, DateTime.UtcNow);

            // Sync total unread count for caller
            var unreadCount = await _chatService.GetTotalUnreadCountAsync(userId);
            await Clients.Caller.UnreadCountUpdated(unreadCount);
        }

        /// <summary>Notify that the current user is typing in a conversation.</summary>
        public async Task NotifyTyping(int conversationId)
        {
            var userId = GetUserId();
            var user = await _userManager.FindByIdAsync(userId);
            var displayName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "Bilinmeyen";

            await Clients.OthersInGroup(ConversationGroup(conversationId))
                .UserTyping(conversationId, userId, displayName);
        }

        // ── Private Helpers ───────────────────────────────────────────

        private string GetUserId()
        {
            var userId = Context.User?.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                throw new HubException("Kullanıcı kimliği belirlenemedi.");
            return userId;
        }

        private static string ConversationGroup(int conversationId) => $"chat:{conversationId}";

        private async Task NotifyPresenceChangeAsync(string userId, bool online)
        {
            var conversations = await _chatService.GetMyConversationsAsync(userId);
            foreach (var conv in conversations)
            {
                if (online)
                    await Clients.OthersInGroup(ConversationGroup(conv.Id)).UserOnline(userId);
                else
                    await Clients.OthersInGroup(ConversationGroup(conv.Id)).UserOffline(userId);
            }
        }
    }
}
