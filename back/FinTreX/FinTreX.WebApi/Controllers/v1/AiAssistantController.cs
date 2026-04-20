using FinTreX.Core.DTOs.AiAssistant;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize(Roles = "User,Economist")] // Admin hariç
    public class AiAssistantController : BaseApiController
    {
        private readonly IAiAssistantService _service;

        public AiAssistantController(IAiAssistantService service)
        {
            _service = service;
        }

        /// <summary>Send a message and get the AI assistant's reply.</summary>
        [HttpPost("chat")]
        [ProducesResponseType(typeof(AiChatResponseDto), 200)]
        [ProducesResponseType(typeof(object), 429)]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request, CancellationToken ct)
        {
            try
            {
                var result = await _service.SendMessageAsync(request, ct);
                return Ok(result);
            }
            catch (ConflictException ex)
            {
                return StatusCode(429, new { message = ex.Message });
            }
        }

        /// <summary>Stream the assistant's reply as SSE chunks.</summary>
        [HttpPost("chat/stream")]
        public async Task ChatStream([FromBody] AiChatRequestDto request, CancellationToken ct)
        {
            Response.Headers["Content-Type"] = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            // For Nginx
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                await _service.StreamMessageAsync(request, Response.Body, ct);
            }
            catch (ConflictException ex)
            {
                Response.StatusCode = 429;
                await Response.WriteAsJsonAsync(new { message = ex.Message }, ct);
            }
        }

        /// <summary>List the user's AI conversations.</summary>
        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var list = await _service.GetConversationsAsync();
            return Ok(list);
        }

        /// <summary>Get a single conversation with messages.</summary>
        [HttpGet("conversations/{id:int}")]
        public async Task<IActionResult> GetConversation(int id)
        {
            var conv = await _service.GetConversationAsync(id);
            if (conv is null) return NotFound();
            return Ok(conv);
        }

        /// <summary>Soft-delete a conversation.</summary>
        [HttpDelete("conversations/{id:int}")]
        public async Task<IActionResult> DeleteConversation(int id)
        {
            await _service.DeleteConversationAsync(id);
            return NoContent();
        }
    }
}
