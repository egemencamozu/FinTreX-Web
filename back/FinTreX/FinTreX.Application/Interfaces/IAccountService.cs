using FinTreX.Core.DTOs.Account;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Contract for self-service authentication operations.
    /// Separated from IUserManagementService (admin-only) per SRP.
    /// </summary>
    public interface IAccountService
    {
        Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress, string userAgent);
        Task<RegisterResponse> RegisterAsync(RegisterRequest request, string origin);

        /// <summary>Verify the email OTP and, on success, issue an authenticated response (JWT + refresh token).</summary>
        Task<AuthenticationResponse> VerifyEmailAsync(VerifyEmailRequest request, string ipAddress, string userAgent);

        /// <summary>Resend the 6-digit email verification code (subject to cooldown).</summary>
        Task ResendVerificationCodeAsync(ResendVerificationRequest request);

        /// <summary>Exchange a valid refresh token for a new JWT + refresh token pair.</summary>
        Task<AuthenticationResponse> RefreshTokenAsync(string token, string ipAddress, string userAgent);

        /// <summary>Revoke a refresh token (e.g. on logout).</summary>
        Task RevokeTokenAsync(string token, string ipAddress);

        /// <summary>Initiate forgot-password flow — generates a reset token.</summary>
        Task<string> ForgotPasswordAsync(ForgotPasswordRequest request);

        /// <summary>Reset password using a valid reset token.</summary>
        Task<string> ResetPasswordAsync(ResetPasswordRequest request);

        /// <summary>Change password for an authenticated user (requires current password).</summary>
        Task ChangePasswordAsync(string userId, ChangePasswordRequest request);

        /// <summary>List active (non-expired, non-revoked) sessions for a user. Marks the current token if provided.</summary>
        Task<IReadOnlyList<SessionDto>> GetSessionsAsync(string userId, string currentToken);

        /// <summary>Revoke a specific session by its id. Owner check enforced inside.</summary>
        Task RevokeSessionAsync(string userId, int sessionId, string ipAddress);

        /// <summary>Revoke every active session except the one matching currentToken.</summary>
        Task RevokeOtherSessionsAsync(string userId, string currentToken, string ipAddress);

        /// <summary>Step 1: send a deletion OTP to the user's email after verifying their password.</summary>
        Task SendDeletionCodeAsync(string userId, string password);

        /// <summary>Step 2: verify the OTP, cancel active subscriptions, then permanently delete the account.</summary>
        Task DeleteMyAccountAsync(string userId, DeleteAccountRequest request);
    }
}
