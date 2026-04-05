using FinTreX.Core.Interfaces;
using FinTreX.Core.Settings;
using FinTreX.Core.Exceptions;
using Microsoft.Extensions.Options;
using System;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly EmailSettings _emailSettings;

        public SmtpEmailService(IOptions<EmailSettings> emailSettings)
        {
            _emailSettings = emailSettings.Value;
        }

        public async Task SendAsync(string toEmail, string subject, string htmlBody)
        {
            if (!_emailSettings.Enabled)
                throw new ApiException("Email service is disabled. Configure EmailSettings and enable it for forgot-password emails.");

            if (string.IsNullOrWhiteSpace(_emailSettings.FromEmail) ||
                string.IsNullOrWhiteSpace(_emailSettings.SmtpHost) ||
                _emailSettings.SmtpPort <= 0)
            {
                throw new ApiException("Email settings are incomplete. Configure FromEmail, SmtpHost and SmtpPort.");
            }

            using var message = new MailMessage
            {
                From = new MailAddress(_emailSettings.FromEmail, _emailSettings.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };

            message.To.Add(new MailAddress(toEmail));

            using var smtpClient = new SmtpClient(_emailSettings.SmtpHost, _emailSettings.SmtpPort)
            {
                EnableSsl = _emailSettings.UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_emailSettings.SmtpUserName, _emailSettings.SmtpPassword)
            };

            await smtpClient.SendMailAsync(message);
        }
    }
}
