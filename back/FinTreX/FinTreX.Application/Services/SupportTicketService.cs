using FinTreX.Core.DTOs.Support;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Core.Services
{
    public class SupportTicketService : ISupportTicketService
    {
        private readonly ISupportTicketRepository _ticketRepository;
        private readonly ISupportTicketMessageRepository _messageRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly IAlertsBroadcaster _broadcaster;
        private readonly ILogger<SupportTicketService> _logger;

        public SupportTicketService(
            ISupportTicketRepository ticketRepository,
            ISupportTicketMessageRepository messageRepository,
            ICurrentUserService currentUserService,
            IAlertsBroadcaster broadcaster,
            ILogger<SupportTicketService> logger)
        {
            _ticketRepository = ticketRepository;
            _messageRepository = messageRepository;
            _currentUserService = currentUserService;
            _broadcaster = broadcaster;
            _logger = logger;
        }

        public async Task<SupportTicketDto> CreateAsync(CreateSupportTicketRequest request)
        {
            if (string.IsNullOrWhiteSpace(_currentUserService.UserId))
                throw new ForbiddenException("Authentication required.");

            var ticket = new SupportTicket
            {
                UserId = _currentUserService.UserId,
                Type = request.Type,
                Subject = request.Subject,
                Status = SupportTicketStatus.Open,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _ticketRepository.AddAsync(ticket);

            var senderName = _currentUserService.Email ?? _currentUserService.UserId;
            var initialMessage = new SupportTicketMessage
            {
                SupportTicketId = ticket.Id,
                SenderId = _currentUserService.UserId,
                SenderRole = "User",
                SenderName = senderName,
                Body = request.Message.Trim(),
                SentAtUtc = ticket.CreatedAtUtc
            };

            await _messageRepository.AddAsync(initialMessage);

            try
            {
                await _broadcaster.PushSupportTicketCreatedForAdminsAsync(new SupportTicketCreatedEventDto
                {
                    TicketId = ticket.Id,
                    Action = "Created",
                    Subject = ticket.Subject,
                    Type = ticket.Type.ToString(),
                    UserName = senderName
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketCreated for ticket {TicketId}", ticket.Id);
            }

            return MapToDto(ticket);
        }

        public async Task<IReadOnlyList<SupportTicketDto>> GetMyTicketsAsync()
        {
            var tickets = await _ticketRepository.GetByUserIdAsync(_currentUserService.UserId);
            return tickets.Select(MapToDto).ToList().AsReadOnly();
        }

        public async Task<IReadOnlyList<SupportTicketDto>> GetAllAsync()
        {
            if (!_currentUserService.IsAdmin)
                throw new ForbiddenException("Admin role required.");

            var tickets = await _ticketRepository.GetAllOrderedAsync();
            return tickets.Select(MapToDto).ToList().AsReadOnly();
        }

        public async Task<SupportTicketDto> GetByIdAsync(int id)
        {
            var ticket = await _ticketRepository.GetByIdAsync(id)
                ?? throw new KeyNotFoundException("Support ticket not found.");

            if (ticket.UserId != _currentUserService.UserId && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Not authorized to view this ticket.");

            return MapToDto(ticket);
        }

        public async Task<SupportTicketDto> UpdateAsync(int id, UpdateSupportTicketRequest request)
        {
            if (!_currentUserService.IsAdmin)
                throw new ForbiddenException("Admin role required.");

            var ticket = await _ticketRepository.GetByIdAsync(id)
                ?? throw new KeyNotFoundException("Support ticket not found.");

            ticket.Status = request.Status;
            ticket.HandledByAdminId = _currentUserService.UserId;
            ticket.RespondedAtUtc = DateTime.UtcNow;

            await _ticketRepository.UpdateAsync(ticket);

            try
            {
                await _broadcaster.PushSupportTicketUpdatedAsync(ticket.UserId, new SupportTicketUpdatedEventDto
                {
                    TicketId = ticket.Id,
                    Subject = ticket.Subject,
                    Status = ticket.Status.ToString(),
                    HasAdminResponse = false,
                    UpdatedByName = _currentUserService.Email ?? "Admin"
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketUpdated for ticket {TicketId}", ticket.Id);
            }

            return MapToDto(ticket);
        }

        public async Task<int> GetOpenCountAsync()
        {
            if (!_currentUserService.IsAdmin)
                throw new ForbiddenException("Admin role required.");

            return await _ticketRepository.CountOpenAsync();
        }

        public async Task DeleteMyTicketAsync(int id)
        {
            var ticket = await _ticketRepository.GetByIdAsync(id)
                ?? throw new KeyNotFoundException("Support ticket not found.");

            if (_currentUserService.IsAdmin)
                throw new ForbiddenException("Destek talepleri yönetici tarafından silinemez. Kayıtlar her zaman korunur.");

            if (ticket.UserId != _currentUserService.UserId)
                throw new ForbiddenException("Not authorized to delete this ticket.");

            if (ticket.Status != SupportTicketStatus.Closed)
                throw new ApiException("Yalnızca 'Kapalı' durumdaki talepler silinebilir.");

            await _ticketRepository.DeleteAsync(ticket);

            try
            {
                await _broadcaster.PushSupportTicketCreatedForAdminsAsync(new SupportTicketCreatedEventDto
                {
                    TicketId = ticket.Id,
                    Action = "Deleted",
                    Subject = ticket.Subject,
                    Type = ticket.Type.ToString(),
                    UserName = _currentUserService.Email ?? _currentUserService.UserId
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketDeleted-to-admins for ticket {TicketId}", ticket.Id);
            }
        }

        public async Task<IReadOnlyList<SupportTicketMessageDto>> GetMessagesAsync(int ticketId)
        {
            var ticket = await _ticketRepository.GetByIdAsync(ticketId)
                ?? throw new KeyNotFoundException("Support ticket not found.");

            if (ticket.UserId != _currentUserService.UserId && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Not authorized to view this ticket.");

            var messages = await _messageRepository.GetByTicketIdAsync(ticketId);
            return messages.Select(MapMessageToDto).ToList().AsReadOnly();
        }

        public async Task<SupportTicketMessageDto> AddMessageAsync(int ticketId, string body, string senderName)
        {
            if (string.IsNullOrWhiteSpace(body))
                throw new ApiException("Mesaj boş olamaz.");

            var ticket = await _ticketRepository.GetByIdAsync(ticketId)
                ?? throw new KeyNotFoundException("Support ticket not found.");

            if (ticket.Status == SupportTicketStatus.Closed)
                throw new ApiException("Kapalı talepler için mesaj gönderilemez.");

            bool isAdmin = _currentUserService.IsAdmin;

            if (!isAdmin && ticket.UserId != _currentUserService.UserId)
                throw new ForbiddenException("Not authorized to send messages to this ticket.");

            var senderRole = isAdmin ? "Admin" : "User";

            // Auto-transition: user replies on InReview/Resolved → back to InReview
            if (!isAdmin && ticket.Status != SupportTicketStatus.Open)
            {
                ticket.Status = SupportTicketStatus.InReview;
                await _ticketRepository.UpdateAsync(ticket);
            }
            // Auto-transition: admin first reply on Open ticket → InReview
            else if (isAdmin && ticket.Status == SupportTicketStatus.Open)
            {
                ticket.Status = SupportTicketStatus.InReview;
                await _ticketRepository.UpdateAsync(ticket);
            }

            var message = new SupportTicketMessage
            {
                SupportTicketId = ticketId,
                SenderId = _currentUserService.UserId,
                SenderRole = senderRole,
                SenderName = senderName,
                Body = body.Trim(),
                SentAtUtc = DateTime.UtcNow
            };

            await _messageRepository.AddAsync(message);

            var eventDto = new SupportTicketMessageAddedEventDto
            {
                TicketId = ticketId,
                MessageId = message.Id,
                SenderRole = senderRole,
                SenderName = senderName
            };

            try
            {
                if (isAdmin)
                    await _broadcaster.PushSupportTicketMessageAsync(ticket.UserId, eventDto);
                else
                    await _broadcaster.PushSupportTicketMessageForAdminsAsync(eventDto);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketMessageAdded for ticket {TicketId}", ticketId);
            }

            return MapMessageToDto(message);
        }

        private static SupportTicketMessageDto MapMessageToDto(SupportTicketMessage m) => new()
        {
            Id = m.Id,
            SupportTicketId = m.SupportTicketId,
            SenderId = m.SenderId,
            SenderRole = m.SenderRole,
            SenderName = m.SenderName,
            Body = m.Body,
            SentAtUtc = m.SentAtUtc
        };

        private static SupportTicketDto MapToDto(SupportTicket t)
        {
            return new SupportTicketDto
            {
                Id = t.Id,
                UserId = t.UserId,
                Type = t.Type,
                Subject = t.Subject,
                Status = t.Status,
                CreatedAtUtc = t.CreatedAtUtc,
                RespondedAtUtc = t.RespondedAtUtc,
                HandledByAdminId = t.HandledByAdminId
            };
        }
    }
}
