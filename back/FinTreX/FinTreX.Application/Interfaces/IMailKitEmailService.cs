using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// MailKit-backed email sender. Registered alongside the legacy
    /// <see cref="IEmailService"/> so feature-specific flows (e.g. OTP email
    /// verification) can opt in without touching existing consumers.
    /// </summary>
    public interface IMailKitEmailService
    {
        Task SendAsync(string toEmail, string subject, string htmlBody);
    }
}
