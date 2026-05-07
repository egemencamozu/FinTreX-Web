using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.Wrappers;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IPaymentHistoryService
    {
        /// <summary>USER: paged payment history for the currently authenticated user.</summary>
        Task<PagedResponse<PaymentTransactionDto>> GetMyPaymentsAsync(int pageNumber, int pageSize);

        /// <summary>USER: single payment detail; caller must own the record.</summary>
        Task<PaymentTransactionDto> GetMyPaymentByIdAsync(int id);

        /// <summary>ADMIN: paged payment history across all users — card details stripped.</summary>
        Task<PagedResponse<AdminPaymentTransactionDto>> GetAllPaymentsAsync(int pageNumber, int pageSize);

        /// <summary>ADMIN: single payment detail — card details stripped.</summary>
        Task<AdminPaymentTransactionDto> GetPaymentByIdForAdminAsync(int id);

        /// <summary>
        /// ADMIN: import historical invoices from Stripe for every user (or a specific one).
        /// Idempotent via StripeInvoiceId unique index.
        /// </summary>
        Task<BackfillResultDto> BackfillFromStripeAsync(string? userId = null);
    }
}
