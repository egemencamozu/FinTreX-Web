using FinTreX.Core.DTOs.Chat;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using FinTreX.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
//deneme
namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class ChatsController : BaseApiController
    {
        private readonly IChatService _chatService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IChatConnectionTracker _connectionTracker;

        public ChatsController(
            IChatService chatService,
            UserManager<ApplicationUser> userManager,
            IChatConnectionTracker connectionTracker)
        {
            _chatService = chatService;
            _userManager = userManager;
            _connectionTracker = connectionTracker;
        }

        /// <summary>Get all conversations for the current user.</summary>
        [HttpGet]
        public async Task<IActionResult> GetMyConversations()
        {
            var conversations = await _chatService.GetMyConversationsAsync();
            await EnrichConversationsAsync(conversations);
            return Ok(conversations);
        }

        /// <summary>Get a single conversation by ID.</summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetConversation(int id)
        {
            var conversation = await _chatService.GetConversationAsync(id);
            await EnrichConversationAsync(conversation);
            return Ok(conversation);
        }

        /// <summary>Create a new conversation (User only).</summary>
        [HttpPost]
        public async Task<IActionResult> CreateConversation(CreateConversationRequest request)
        {
            var conversation = await _chatService.CreateConversationAsync(request);
            await EnrichConversationAsync(conversation);
            return CreatedAtAction(nameof(GetConversation), new { id = conversation.Id }, conversation);
        }

        /// <summary>Delete a conversation (soft-delete for current user).</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteConversation(int id)
        {
            await _chatService.DeleteConversationAsync(id);
            return NoContent();
        }

        /// <summary>Update conversation title.</summary>
        [HttpPatch("{id}/title")]
        public async Task<IActionResult> UpdateTitle(int id, UpdateConversationTitleRequest request)
        {
            await _chatService.UpdateConversationTitleAsync(id, request.Title);
            return NoContent();
        }

        /// <summary>Get messages with cursor-based pagination.</summary>
        [HttpGet("{id}/messages")]
        public async Task<IActionResult> GetMessages(int id, [FromQuery] long? before, [FromQuery] int pageSize = 30)
        {
            var result = await _chatService.GetMessagesAsync(id, before, pageSize);

            // Enrich sender names
            foreach (var msg in result.Items)
            {
                var sender = await _userManager.FindByIdAsync(msg.SenderId);
                msg.SenderName = sender != null
                    ? $"{sender.FirstName} {sender.LastName}".Trim()
                    : "Bilinmeyen";
            }

            return Ok(result);
        }

        /// <summary>Get total unread message count across all conversations.</summary>
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _chatService.GetTotalUnreadCountAsync();
            return Ok(new { totalUnreadCount = count });
        }

        // ── Private Helpers ───────────────────────────────────────────

        private async Task EnrichConversationsAsync(IEnumerable<ConversationDto> conversations)
        {
            foreach (var conv in conversations)
            {
                await EnrichConversationAsync(conv);
            }
        }

        private async Task EnrichConversationAsync(ConversationDto conv)
        {
            // Enrich participant display names and online status
            foreach (var p in conv.Participants)
            {
                var user = await _userManager.FindByIdAsync(p.UserId);
                p.DisplayName = user != null
                    ? $"{user.FirstName} {user.LastName}".Trim()
                    : "Bilinmeyen";
                p.IsOnline = _connectionTracker.IsOnline(p.UserId);
            }

            // Enrich last message sender name
            if (conv.LastMessage != null)
            {
                var sender = await _userManager.FindByIdAsync(conv.LastMessage.SenderId);
                conv.LastMessage.SenderName = sender != null
                    ? $"{sender.FirstName} {sender.LastName}".Trim()
                    : "Bilinmeyen";
            }
        }
    }
}
