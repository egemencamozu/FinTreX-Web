using FinTreX.Core.DTOs.AiAssistant;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IAiAssistantService
    {
        /// <summary>Send a message and get the AI assistant's reply (non-streaming).</summary>
        Task<AiChatResponseDto> SendMessageAsync(AiChatRequestDto request, CancellationToken ct = default);

        /// <summary>
        /// Stream the assistant's reply as SSE-formatted chunks (proxied from ai-service).
        /// The destination stream is where the raw chunks are written directly.
        /// </summary>
        Task StreamMessageAsync(
            AiChatRequestDto request,
            Stream destination,
            CancellationToken ct = default);

        // ── Conversation history ──
        Task<IReadOnlyList<AiConversationListItemDto>> GetConversationsAsync();
        Task<AiConversationDto?> GetConversationAsync(int conversationId);
        Task DeleteConversationAsync(int conversationId);
    }
}
