using System.Threading.Tasks;
using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.DTOs.PriceAlert;
using FinTreX.Core.DTOs.Support;
using FinTreX.Core.DTOs.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Arka plan değerlendirme servisi, alarm tetiklendiğinde kullanıcıya anlık
    /// push yapmak için bu arayüzü kullanır. Gerçek implementasyon WebApi
    /// katmanında SignalR üzerinden yazılır.
    /// </summary>
    public interface IAlertsBroadcaster
    {
        Task PushAlertTriggeredAsync(string userId, AlertTriggerEventDto payload);
        Task PushTaskCreatedAsync(string userId, TaskCreatedEventDto payload);
        Task PushTaskStatusChangedAsync(string userId, TaskStatusChangedEventDto payload);
        Task PushTaskCompletedAsync(string userId, TaskCompletedEventDto payload);
        Task PushSupportTicketCreatedForAdminsAsync(SupportTicketCreatedEventDto payload);
        Task PushSupportTicketUpdatedAsync(string userId, SupportTicketUpdatedEventDto payload);
        Task PushSupportTicketMessageAsync(string userId, SupportTicketMessageAddedEventDto payload);
        Task PushSupportTicketMessageForAdminsAsync(SupportTicketMessageAddedEventDto payload);
        Task PushEconomistClientAssignedAsync(string economistId, EconomistClientAssignedEventDto payload);
        Task PushEconomistClientChangedAsync(string userId, EconomistClientChangedEventDto payload);
        Task PushEconomistClientChangedForAdminsAsync(EconomistClientChangedEventDto payload);
        Task PushTaskRatedAsync(string economistId, TaskRatedEventDto payload);
        Task PushTaskRatedForAdminsAsync(TaskRatedEventDto payload);
        Task PushEconomistApplicationSubmittedToAdminsAsync(EconomistApplicationSubmittedEventDto payload);
        Task PushEconomistApplicationDecisionAsync(string economistUserId, EconomistApplicationDecisionEventDto payload);
        Task PushSessionRevokedAsync(string userId);
    }
}
