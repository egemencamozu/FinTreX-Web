using System.Threading.Tasks;
using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.DTOs.Support;
using FinTreX.Core.DTOs.Tasks;
using FinTreX.Core.Interfaces;
using FinTreX.WebApi.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace FinTreX.WebApi.Services
{
    /// <summary>
    /// Application katmanındaki <see cref="IAlertsBroadcaster"/> arayüzünü
    /// SignalR üzerinden gerçekleştirir. Sadece alarmı kuran kullanıcıya gider.
    /// </summary>
    public class AlertsBroadcaster : IAlertsBroadcaster
    {
        private readonly IHubContext<AlertsHub, IAlertsClient> _hub;
        private readonly ILogger<AlertsBroadcaster> _logger;

        public AlertsBroadcaster(IHubContext<AlertsHub, IAlertsClient> hub, ILogger<AlertsBroadcaster> logger)
        {
            _hub = hub;
            _logger = logger;
        }

        public async Task PushAlertTriggeredAsync(string userId, AlertTriggerEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .AlertTriggered(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push AlertTriggered for user {UserId}, alert {AlertId}", userId, payload.AlertId);
            }
        }

        public async Task PushTaskCreatedAsync(string userId, TaskCreatedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .TaskCreated(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskCreated for user {UserId}, task {TaskId}", userId, payload.TaskId);
            }
        }

        public async Task PushTaskStatusChangedAsync(string userId, TaskStatusChangedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .TaskStatusChanged(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskStatusChanged for user {UserId}, task {TaskId}", userId, payload.TaskId);
            }
        }

        public async Task PushTaskCompletedAsync(string userId, TaskCompletedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .TaskCompleted(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskCompleted for user {UserId}, task {TaskId}", userId, payload.TaskId);
            }
        }

        public async Task PushSupportTicketCreatedForAdminsAsync(SupportTicketCreatedEventDto payload)
        {
            if (payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.AdminGroupName)
                    .SupportTicketCreated(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketCreated for ticket {TicketId}", payload.TicketId);
            }
        }

        public async Task PushSupportTicketUpdatedAsync(string userId, SupportTicketUpdatedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .SupportTicketUpdated(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketUpdated for user {UserId}, ticket {TicketId}", userId, payload.TicketId);
            }
        }

        public async Task PushSupportTicketMessageAsync(string userId, SupportTicketMessageAddedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .SupportTicketMessageAdded(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketMessageAdded for user {UserId}, ticket {TicketId}", userId, payload.TicketId);
            }
        }

        public async Task PushSupportTicketMessageForAdminsAsync(SupportTicketMessageAddedEventDto payload)
        {
            if (payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.AdminGroupName)
                    .SupportTicketMessageAdded(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SupportTicketMessageAdded for admins, ticket {TicketId}", payload.TicketId);
            }
        }

        public async Task PushEconomistClientAssignedAsync(string economistId, EconomistClientAssignedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(economistId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(economistId))
                    .EconomistClientAssigned(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistClientAssigned for economist {EconomistId}, assignment {AssignmentId}", economistId, payload.AssignmentId);
            }
        }

        public async Task PushEconomistClientChangedAsync(string userId, EconomistClientChangedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(userId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .EconomistClientChanged(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistClientChanged for user {UserId}, assignment {AssignmentId}", userId, payload.AssignmentId);
            }
        }

        public async Task PushEconomistClientChangedForAdminsAsync(EconomistClientChangedEventDto payload)
        {
            if (payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.AdminGroupName)
                    .EconomistClientChanged(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistClientChanged for admins, assignment {AssignmentId}", payload.AssignmentId);
            }
        }

        public async Task PushTaskRatedAsync(string economistId, TaskRatedEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(economistId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(economistId))
                    .TaskRated(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskRated for economist {EconomistId}, task {TaskId}", economistId, payload.TaskId);
            }
        }

        public async Task PushTaskRatedForAdminsAsync(TaskRatedEventDto payload)
        {
            if (payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.AdminGroupName)
                    .TaskRated(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskRated for admins, task {TaskId}", payload.TaskId);
            }
        }

        public async Task PushEconomistApplicationSubmittedToAdminsAsync(EconomistApplicationSubmittedEventDto payload)
        {
            if (payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.AdminGroupName)
                    .EconomistApplicationSubmitted(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistApplicationSubmitted for admins, application {ApplicationId}", payload.ApplicationId);
            }
        }

        public async Task PushEconomistApplicationDecisionAsync(string economistUserId, EconomistApplicationDecisionEventDto payload)
        {
            if (string.IsNullOrWhiteSpace(economistUserId) || payload is null) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(economistUserId))
                    .EconomistApplicationDecision(payload);
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistApplicationDecision for user {UserId}, application {ApplicationId}", economistUserId, payload.ApplicationId);
            }
        }

        public async Task PushSessionRevokedAsync(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId)) return;

            try
            {
                await _hub.Clients.Group(AlertsHub.BuildGroupName(userId))
                    .SessionRevoked();
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push SessionRevoked for user {UserId}", userId);
            }
        }
    }
}
