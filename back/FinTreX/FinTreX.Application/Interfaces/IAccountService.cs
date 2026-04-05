using FinTreX.Core.DTOs.Account;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Contract for self-service authentication operations.
    /// Separated from IUserManagementService (admin-only) per SRP.
    /// </summary>
    public interface IAccountService
    {
        Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress);
        Task<string> RegisterAsync(RegisterRequest request, string origin);

        /// <summary>Exchange a valid refresh token for a new JWT + refresh token pair.</summary>
        Task<AuthenticationResponse> RefreshTokenAsync(string token, string ipAddress);

        /// <summary>Revoke a refresh token (e.g. on logout).</summary>
        Task RevokeTokenAsync(string token, string ipAddress);

        /// <summary>Initiate forgot-password flow — generates a reset token.</summary>
        Task<string> ForgotPasswordAsync(ForgotPasswordRequest request);

        /// <summary>Reset password using a valid reset token.</summary>
        Task<string> ResetPasswordAsync(ResetPasswordRequest request);
    }
}
