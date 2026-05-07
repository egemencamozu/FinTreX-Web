using FinTreX.Core.DTOs.Payment;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    /// <summary>
    /// Provides aggregated revenue and subscription analytics for the admin dashboard.
    /// Split into three methods so the frontend can call them in parallel:
    ///   - Summary  → fast (DB only)
    ///   - Trends   → fast (DB only)
    ///   - StripeLive → slower (Stripe API calls)
    /// </summary>
    public interface IAdminRevenueDashboardService
    {
        /// <summary>KPI cards, plan breakdown, status distribution (DB).</summary>
        Task<AdminDashboardSummaryDto> GetSummaryAsync();

        /// <summary>Monthly revenue trend (12 months) and subscription analytics (DB).</summary>
        Task<AdminDashboardTrendsDto> GetTrendsAsync();

        /// <summary>Live Stripe balance, payouts, fees, disputes + DB card/failure analytics.</summary>
        Task<AdminDashboardStripeLiveDto> GetStripeLiveAsync();
    }
}
