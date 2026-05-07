using System.Threading.Tasks;
using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.DTOs.Support;
using FinTreX.Core.DTOs.Tasks;

namespace FinTreX.WebApi.Hubs
{
    /// <summary>
    /// AlertsHub'a bağlı client'ların uygulaması gereken metodlar.
    /// Strongly-typed hub client desenini takip eder.
    /// </summary>
    public interface IAlertsClient
    {
        Task AlertTriggered(AlertTriggerEventDto payload);
        Task TaskCreated(TaskCreatedEventDto payload);
        Task TaskStatusChanged(TaskStatusChangedEventDto payload);
        Task TaskCompleted(TaskCompletedEventDto payload);
        Task SupportTicketCreated(SupportTicketCreatedEventDto payload);
        Task SupportTicketUpdated(SupportTicketUpdatedEventDto payload);
        Task SupportTicketMessageAdded(SupportTicketMessageAddedEventDto payload);
        Task EconomistClientAssigned(EconomistClientAssignedEventDto payload);
        Task EconomistClientChanged(EconomistClientChangedEventDto payload);
        Task TaskRated(TaskRatedEventDto payload);
        Task EconomistApplicationSubmitted(EconomistApplicationSubmittedEventDto payload);
        Task EconomistApplicationDecision(EconomistApplicationDecisionEventDto payload);
        Task SessionRevoked();
    }
}
