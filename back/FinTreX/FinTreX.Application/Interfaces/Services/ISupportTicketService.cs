using FinTreX.Core.DTOs.Support;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface ISupportTicketService
    {
        Task<SupportTicketDto> CreateAsync(CreateSupportTicketRequest request);
        Task<IReadOnlyList<SupportTicketDto>> GetMyTicketsAsync();
        Task<IReadOnlyList<SupportTicketDto>> GetAllAsync();
        Task<SupportTicketDto> GetByIdAsync(int id);
        Task<SupportTicketDto> UpdateAsync(int id, UpdateSupportTicketRequest request);
        Task<int> GetOpenCountAsync();
        Task DeleteMyTicketAsync(int id);
        Task<IReadOnlyList<SupportTicketMessageDto>> GetMessagesAsync(int ticketId);
        Task<SupportTicketMessageDto> AddMessageAsync(int ticketId, string body, string senderName);
    }
}
