using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Handles issuing and verifying 6-digit email OTP codes used during the
    /// registration flow. Cooldown / attempt caps are enforced inside.
    /// </summary>
    public interface IEmailVerificationService
    {
        /// <summary>
        /// Generate a new OTP for the given user and send it via MailKit.
        /// Invalidates any outstanding (unused + unexpired) token for the user.
        /// </summary>
        Task GenerateAndSendAsync(string applicationUserId, string email);

        /// <summary>
        /// Verify the supplied 6-digit code. Marks the user's email as
        /// confirmed on success. Throws on invalid / expired / over-attempted codes.
        /// </summary>
        Task<bool> VerifyAsync(string email, string code);

        /// <summary>
        /// Resend a fresh OTP. Enforces a 60-second cooldown between sends.
        /// </summary>
        Task ResendAsync(string email);
    }
}
