using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces
{
    public interface IEmailService
    {
        Task SendAsync(string toEmail, string subject, string htmlBody);
    }
}
