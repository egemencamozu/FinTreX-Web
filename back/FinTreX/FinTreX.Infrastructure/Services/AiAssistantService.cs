using FinTreX.Core.DTOs.AiAssistant;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class AiAssistantService : IAiAssistantService
    {
        private readonly HttpClient _http;
        private readonly IAiConversationRepository _repo;
        private readonly ICurrentUserService _currentUser;
        private readonly IEconomistClientRepository _econClientRepo;
        private readonly AiAssistantSettings _settings;
        private readonly ILogger<AiAssistantService> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true
        };

        public AiAssistantService(
            HttpClient http,
            IAiConversationRepository repo,
            ICurrentUserService currentUser,
            IEconomistClientRepository econClientRepo,
            IOptions<AiAssistantSettings> settings,
            ILogger<AiAssistantService> logger)
        {
            _http = http;
            _repo = repo;
            _currentUser = currentUser;
            _econClientRepo = econClientRepo;
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task<AiChatResponseDto> SendMessageAsync(AiChatRequestDto request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var role = ResolveRole();

            // ── 1. Economist client guard ──
            if (request.ClientId is not null && role == "ECONOMIST")
            {
                var assigned = await _econClientRepo.IsClientAssignedAsync(userId, request.ClientId);
                if (!assigned)
                    throw new UnauthorizedAccessException("Bu müşteri size atanmamış.");
            }
            else if (request.ClientId is not null && role != "ECONOMIST")
            {
                throw new UnauthorizedAccessException("ClientId sadece ekonomistler için geçerlidir.");
            }

            // ── 2. Conversation ensure ──
            var conversation = request.ConversationId.HasValue
                ? await _repo.GetByIdForUserAsync(request.ConversationId.Value, userId)
                : null;

            if (request.ConversationId.HasValue && conversation is null)
                throw new KeyNotFoundException("Konuşma bulunamadı.");

            conversation ??= await _repo.CreateAsync(new AiConversation
            {
                UserId = userId,
                Title = BuildTitleFromMessage(request.Message),
                CreatedAtUtc = DateTime.UtcNow,
            });

            // ── 3. Concurrency lock ──
            await MaybeReleaseStaleLockAsync(conversation);

            if (!await _repo.TryAcquireProcessingLockAsync(conversation.Id))
                throw new ConflictException("Bu konuşmada bir mesaj işleniyor, lütfen bekleyin.");

            try
            {
                // ── 4. User message persist ──
                var userMsg = await _repo.AddMessageAsync(new AiChatMessage
                {
                    AiConversationId = conversation.Id,
                    Role = AiMessageRole.User,
                    Content = request.Message,
                    SentAtUtc = DateTime.UtcNow,
                });

                // ── 5. History ──
                var history = await _repo.GetLastMessagesAsync(conversation.Id, _settings.MaxConversationHistoryMessages);
                var historyPayload = history
                    .Where(m => m.Id != userMsg.Id) 
                    .Select(m => new
                    {
                        role = m.Role == AiMessageRole.User ? "user" : "assistant",
                        content = m.Content
                    })
                    .ToList();

                // ── 6. HTTP call ──
                var authToken = _currentUser.AuthToken
                    ?? throw new InvalidOperationException("Auth token is not available in the current request context.");

                var payload = new
                {
                    conversation_id = $"conv_{conversation.Id}",
                    message = request.Message,
                    user_id = userId,
                    user_role = role,
                    auth_token = authToken,
                    context = new { client_id = request.ClientId },
                    conversation_history = historyPayload,
                };

                var endpoint = _settings.ChatEndpoint;
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
                {
                    Content = JsonContent.Create(payload, options: _jsonOptions)
                };

                using var response = await _http.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, ct);
                response.EnsureSuccessStatusCode();

                var aiReply = await response.Content.ReadFromJsonAsync<PythonChatResponse>(_jsonOptions, ct)
                    ?? throw new InvalidOperationException("ai-service returned null response.");

                if (!aiReply.IsSuccessful)
                    throw new InvalidOperationException(aiReply.ErrorMessage ?? "ai-service reported failure.");

                // ── 7. Assistant message persist ──
                var assistantMsg = await _repo.AddMessageAsync(new AiChatMessage
                {
                    AiConversationId = conversation.Id,
                    Role = AiMessageRole.Assistant,
                    Content = aiReply.Message ?? string.Empty,
                    ToolsUsed = aiReply.ToolsUsed is { Count: > 0 }
                        ? JsonSerializer.Serialize(aiReply.ToolsUsed)
                        : null,
                    PartialData = aiReply.PartialData,
                    SentAtUtc = DateTime.UtcNow,
                });

                return new AiChatResponseDto
                {
                    ConversationId = conversation.Id,
                    MessageId = assistantMsg.Id,
                    Message = assistantMsg.Content,
                    ToolsUsed = aiReply.ToolsUsed ?? new List<string>(),
                    PartialData = aiReply.PartialData,
                    IsSuccessful = true,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AiAssistant SendMessage failed for conv {ConvId}, user {UserId}", conversation.Id, userId);
                throw;
            }
            finally
            {
                await _repo.ReleaseProcessingLockAsync(conversation.Id);
            }
        }

        public async Task StreamMessageAsync(AiChatRequestDto request, Stream destination, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var role = ResolveRole();

            if (request.ClientId is not null && role == "ECONOMIST")
            {
                var assigned = await _econClientRepo.IsClientAssignedAsync(userId, request.ClientId);
                if (!assigned)
                    throw new UnauthorizedAccessException("Bu müşteri size atanmamış.");
            }

            var conversation = request.ConversationId.HasValue
                ? await _repo.GetByIdForUserAsync(request.ConversationId.Value, userId)
                : null;

            if (request.ConversationId.HasValue && conversation is null)
                throw new KeyNotFoundException("Konuşma bulunamadı.");

            conversation ??= await _repo.CreateAsync(new AiConversation
            {
                UserId = userId,
                Title = BuildTitleFromMessage(request.Message),
                CreatedAtUtc = DateTime.UtcNow,
            });

            await MaybeReleaseStaleLockAsync(conversation);

            if (!await _repo.TryAcquireProcessingLockAsync(conversation.Id))
                throw new ConflictException("Bu konuşmada bir mesaj işleniyor.");

            var accumulator = new StringBuilder();
            var toolsUsed = new List<string>();
            var partialData = false;

            try
            {
                var userMsg = await _repo.AddMessageAsync(new AiChatMessage
                {
                    AiConversationId = conversation.Id,
                    Role = AiMessageRole.User,
                    Content = request.Message,
                    SentAtUtc = DateTime.UtcNow,
                });

                var history = await _repo.GetLastMessagesAsync(conversation.Id, _settings.MaxConversationHistoryMessages);
                var historyPayload = history
                    .Where(m => m.Id != userMsg.Id)
                    .Select(m => new {
                        role = m.Role == AiMessageRole.User ? "user" : "assistant",
                        content = m.Content
                    })
                    .ToList();

                var authToken = _currentUser.AuthToken ?? throw new InvalidOperationException("Auth token missing.");

                var payload = new
                {
                    conversation_id = $"conv_{conversation.Id}",
                    message = request.Message,
                    user_id = userId,
                    user_role = role,
                    auth_token = authToken,
                    context = new { client_id = request.ClientId },
                    conversation_history = historyPayload,
                };

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, _settings.StreamEndpoint)
                {
                    Content = JsonContent.Create(payload, options: _jsonOptions)
                };
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

                using var response = await _http.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, ct);
                response.EnsureSuccessStatusCode();

                await using var upstream = await response.Content.ReadAsStreamAsync(ct);
                using var reader = new StreamReader(upstream);
                await using var writer = new StreamWriter(destination, Encoding.UTF8) { AutoFlush = false };

                string? line;
                while ((line = await reader.ReadLineAsync(ct)) is not null)
                {
                    await writer.WriteLineAsync(line);
                    await writer.FlushAsync();

                    if (line.StartsWith("data: "))
                    {
                        var json = line[6..];
                        try
                        {
                            using var doc = JsonDocument.Parse(json);
                            var root = doc.RootElement;
                            if (!root.TryGetProperty("type", out var typeEl)) continue;
                            var type = typeEl.GetString();

                            switch (type)
                            {
                                case "token":
                                    if (root.TryGetProperty("content", out var contentEl))
                                        accumulator.Append(contentEl.GetString());
                                    break;
                                case "tool_start":
                                    if (root.TryGetProperty("tool", out var toolEl))
                                        toolsUsed.Add(toolEl.GetString() ?? "");
                                    break;
                                case "done":
                                    if (root.TryGetProperty("partial_data", out var pdEl))
                                        partialData = pdEl.GetBoolean();
                                    break;
                            }
                        }
                        catch (JsonException) { }
                    }
                }

                if (accumulator.Length > 0)
                {
                    await _repo.AddMessageAsync(new AiChatMessage
                    {
                        AiConversationId = conversation.Id,
                        Role = AiMessageRole.Assistant,
                        Content = accumulator.ToString(),
                        ToolsUsed = toolsUsed.Count > 0 ? JsonSerializer.Serialize(toolsUsed.Distinct().ToList()) : null,
                        PartialData = partialData,
                        SentAtUtc = DateTime.UtcNow,
                    });
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Stream failed for conv {ConvId}", conversation.Id);
                try
                {
                    await using var writer = new StreamWriter(destination, Encoding.UTF8) { AutoFlush = false };
                    var errJson = JsonSerializer.Serialize(new { type = "error", message = "Sunucu hatası" });
                    await writer.WriteLineAsync($"data: {errJson}");
                    await writer.WriteLineAsync();
                    await writer.FlushAsync();
                }
                catch { }
            }
            finally
            {
                await _repo.ReleaseProcessingLockAsync(conversation.Id);
            }
        }

        public async Task<IReadOnlyList<AiConversationListItemDto>> GetConversationsAsync()
        {
            var userId = _currentUser.UserId;
            var list = await _repo.GetByUserIdAsync(userId, _settings.MaxConversationsPerUser);
            return list.Select(c => new AiConversationListItemDto
            {
                Id = c.Id,
                Title = c.Title,
                CreatedAtUtc = c.CreatedAtUtc,
                LastMessageAtUtc = c.LastMessageAtUtc,
                LastMessagePreview = null,
            }).ToList().AsReadOnly();
        }

        public async Task<AiConversationDto?> GetConversationAsync(int conversationId)
        {
            var userId = _currentUser.UserId;
            var conv = await _repo.GetByIdForUserAsync(conversationId, userId, includeMessages: true);
            if (conv is null) return null;

            return new AiConversationDto
            {
                Id = conv.Id,
                Title = conv.Title,
                CreatedAtUtc = conv.CreatedAtUtc,
                LastMessageAtUtc = conv.LastMessageAtUtc,
                Messages = conv.Messages.Select(m => new AiChatMessageDto
                {
                    Id = m.Id,
                    Role = m.Role,
                    Content = m.Content,
                    ToolsUsed = DeserializeTools(m.ToolsUsed),
                    PartialData = m.PartialData,
                    SentAtUtc = m.SentAtUtc,
                }).ToList().AsReadOnly(),
            };
        }

        public async Task DeleteConversationAsync(int conversationId)
        {
            var userId = _currentUser.UserId;
            var conv = await _repo.GetByIdForUserAsync(conversationId, userId);
            if (conv is null) throw new KeyNotFoundException("Konuşma bulunamadı.");
            await _repo.SoftDeleteAsync(conversationId);
        }

        private string ResolveRole() => _currentUser.IsEconomist ? "ECONOMIST" : "USER";

        private static string? BuildTitleFromMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return null;
            var trimmed = message.Trim();
            return trimmed.Length <= 60 ? trimmed : trimmed[..60] + "…";
        }

        private async Task MaybeReleaseStaleLockAsync(AiConversation conv)
        {
            if (!conv.IsProcessing || conv.ProcessingStartedAtUtc is null) return;

            var elapsed = DateTime.UtcNow - conv.ProcessingStartedAtUtc.Value;
            if (elapsed.TotalSeconds > _settings.ProcessingLockTimeoutSeconds)
            {
                _logger.LogWarning("Releasing stale processing lock for conv {ConvId} (elapsed {Sec}s)", conv.Id, elapsed.TotalSeconds);
                await _repo.ReleaseProcessingLockAsync(conv.Id);
                conv.IsProcessing = false;
            }
        }

        private static IReadOnlyList<string> DeserializeTools(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<string>();
            try { return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>(); }
            catch { return new List<string>(); }
        }

        private sealed class PythonChatResponse
        {
            public string ConversationId { get; set; }
            public string Message { get; set; }
            public List<string> ToolsUsed { get; set; } = new();
            public bool IsSuccessful { get; set; }
            public string? ErrorMessage { get; set; }
            public bool PartialData { get; set; }
        }
    }
}
