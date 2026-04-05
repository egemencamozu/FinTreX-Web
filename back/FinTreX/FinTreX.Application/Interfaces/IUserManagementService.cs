using FinTreX.Core.DTOs.Account;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Contract for admin-level user management operations.
    /// Separated from IAccountService (SRP) because these are admin-only concerns
    /// while IAccountService handles self-service auth flows.
    /// </summary>
    public interface IUserManagementService
    {
        /// <summary>Returns all registered users with their primary role.</summary>
        Task<IReadOnlyList<UserSummaryDto>> GetAllUsersAsync();

        /// <summary>Returns a single user by their Identity ID.</summary>
        Task<UserSummaryDto> GetUserByIdAsync(string userId);

        /// <summary>Deactivates user account for a selected duration.</summary>
        Task<string> DeactivateUserAsync(string userId, string durationKey);

        /// <summary>Re-activates a previously deactivated user account.</summary>
        Task<string> ActivateUserAsync(string userId);
    }
}
