using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Settings;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using System;
using System.Security.Authentication;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class MailKitEmailService : IMailKitEmailService
    {
        private readonly EmailSettings _emailSettings;
        private readonly ILogger<MailKitEmailService> _logger;

        public MailKitEmailService(
            IOptions<EmailSettings> emailSettings,
            ILogger<MailKitEmailService> logger)
        {
            _emailSettings = emailSettings.Value;
            _logger = logger;
        }

        public async Task SendAsync(string toEmail, string subject, string htmlBody)
        {
            if (!_emailSettings.Enabled)
                throw new ApiException("Email service is disabled. Enable EmailSettings to send mail.");

            if (string.IsNullOrWhiteSpace(_emailSettings.FromEmail) ||
                string.IsNullOrWhiteSpace(_emailSettings.SmtpHost) ||
                _emailSettings.SmtpPort <= 0)
            {
                throw new ApiException("Email settings are incomplete. Configure FromEmail, SmtpHost and SmtpPort.");
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_emailSettings.FromName ?? string.Empty, _emailSettings.FromEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var client = new SmtpClient();

            try
            {
                // Force TLS 1.2+ to avoid "frame size" handshake errors on some
                // Windows machines where older protocols are offered first.
                client.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13;

                // Determine TLS mode from PORT, not from the UseSsl flag, because
                // config merging across environments can silently flip that flag.
                //   - Port 465 → implicit SSL (SslOnConnect)
                //   - Port 587 → mandatory STARTTLS (StartTls)
                //   - Other    → fall back to the UseSsl flag
                var socketOptions = _emailSettings.SmtpPort switch
                {
                    465 => SecureSocketOptions.SslOnConnect,
                    587 => SecureSocketOptions.StartTls,
                    _   => _emailSettings.UseSsl
                            ? SecureSocketOptions.SslOnConnect
                            : SecureSocketOptions.StartTls
                };

                _logger.LogInformation(
                    "Connecting to {Host}:{Port} with {Options}, TLS {Protocols}",
                    _emailSettings.SmtpHost, _emailSettings.SmtpPort, socketOptions, client.SslProtocols);

                await client.ConnectAsync(_emailSettings.SmtpHost, _emailSettings.SmtpPort, socketOptions);

                if (!string.IsNullOrWhiteSpace(_emailSettings.SmtpUserName))
                {
                    await client.AuthenticateAsync(_emailSettings.SmtpUserName, _emailSettings.SmtpPassword);
                }

                await client.SendAsync(message);
                _logger.LogInformation("Email sent to {To}", toEmail);
            }
            catch (Exception ex) when (ex is not ApiException)
            {
                _logger.LogError(ex, "Failed to send email to {To} via {Host}:{Port}",
                    toEmail, _emailSettings.SmtpHost, _emailSettings.SmtpPort);
                var reason = ex.InnerException?.Message ?? ex.Message;
                throw new ApiException($"Email could not be sent. {reason}");
            }
            finally
            {
                if (client.IsConnected)
                {
                    await client.DisconnectAsync(true);
                }
            }
        }
    }
}
