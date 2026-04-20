using FinTreX.Core.Entities;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Infrastructure.Contexts;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private const int OtpLength = 6;
        private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
        private const int MaxAttempts = 5;

        private readonly ApplicationDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IMailKitEmailService _mailService;

        public EmailVerificationService(
            ApplicationDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            IMailKitEmailService mailService)
        {
            _dbContext = dbContext;
            _userManager = userManager;
            _mailService = mailService;
        }

        public async Task GenerateAndSendAsync(string applicationUserId, string email)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId))
                throw new ApiException("User id is required.");
            if (string.IsNullOrWhiteSpace(email))
                throw new ApiException("Email is required.");

            await InvalidateActiveTokensAsync(applicationUserId);

            var code = GenerateOtp();
            var token = new EmailVerificationToken
            {
                ApplicationUserId = applicationUserId,
                Email = email,
                CodeHash = HashCode(code),
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.Add(OtpLifetime),
                AttemptCount = 0,
                IsUsed = false
            };

            _dbContext.Set<EmailVerificationToken>().Add(token);
            await _dbContext.SaveChangesAsync();

            await _mailService.SendAsync(email, "FinTreX - Email Doğrulama Kodu", BuildHtmlBody(code));
        }

        public async Task ResendAsync(string email)
        {
            var user = await _userManager.FindByEmailAsync(email)
                ?? throw new ApiException("No account found for this email.");

            if (user.EmailConfirmed)
                throw new ApiException("This email is already verified.");

            var latest = await _dbContext.Set<EmailVerificationToken>()
                .AsNoTracking()
                .Where(t => t.ApplicationUserId == user.Id)
                .OrderByDescending(t => t.CreatedAt)
                .FirstOrDefaultAsync();

            if (latest != null)
            {
                var elapsed = DateTime.UtcNow - latest.CreatedAt;
                if (elapsed < ResendCooldown)
                {
                    var remaining = (int)Math.Ceiling((ResendCooldown - elapsed).TotalSeconds);
                    throw new ApiException($"Yeni kod istemek için {remaining} saniye bekleyin.");
                }
            }

            await GenerateAndSendAsync(user.Id, user.Email);
        }

        public async Task<bool> VerifyAsync(string email, string code)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ApiException("Email is required.");
            if (string.IsNullOrWhiteSpace(code) || code.Length != OtpLength || !code.All(char.IsDigit))
                throw new ApiException("Doğrulama kodu 6 haneli rakam olmalıdır.");

            var user = await _userManager.FindByEmailAsync(email)
                ?? throw new ApiException("No account found for this email.");

            if (user.EmailConfirmed)
                throw new ApiException("This email is already verified.");

            // Tracked query so we can mutate + save.
            var token = await _dbContext.Set<EmailVerificationToken>()
                .Where(t => t.ApplicationUserId == user.Id && !t.IsUsed)
                .OrderByDescending(t => t.CreatedAt)
                .FirstOrDefaultAsync();

            if (token == null)
                throw new ApiException("Geçerli bir doğrulama kodu bulunamadı. Yeniden kod isteyin.");

            if (token.ExpiresAt <= DateTime.UtcNow)
                throw new ApiException("Doğrulama kodunun süresi dolmuş. Yeniden kod isteyin.");

            token.AttemptCount += 1;

            if (token.AttemptCount > MaxAttempts)
            {
                token.IsUsed = true; // invalidate
                await _dbContext.SaveChangesAsync();
                throw new ApiException("Çok fazla hatalı deneme. Yeniden kod isteyin.");
            }

            var providedHash = HashCode(code);
            if (!FixedTimeEquals(providedHash, token.CodeHash))
            {
                await _dbContext.SaveChangesAsync();
                var remaining = Math.Max(0, MaxAttempts - token.AttemptCount);
                throw new ApiException($"Kod hatalı. Kalan deneme: {remaining}.");
            }

            token.IsUsed = true;
            token.UsedAt = DateTime.UtcNow;
            user.EmailConfirmed = true;

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                throw new ApiException(string.Join(" ", updateResult.Errors.Select(e => e.Description)));
            }

            await _dbContext.SaveChangesAsync();
            return true;
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private async Task InvalidateActiveTokensAsync(string userId)
        {
            var active = await _dbContext.Set<EmailVerificationToken>()
                .Where(t => t.ApplicationUserId == userId && !t.IsUsed)
                .ToListAsync();

            if (active.Count == 0) return;

            foreach (var t in active)
            {
                t.IsUsed = true;
            }
            await _dbContext.SaveChangesAsync();
        }

        private static string GenerateOtp()
        {
            // 0 – 999,999 uniformly, zero-padded
            var value = RandomNumberGenerator.GetInt32(0, 1_000_000);
            return value.ToString("D6");
        }

        private static string HashCode(string code)
        {
            var bytes = Encoding.UTF8.GetBytes(code);
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static bool FixedTimeEquals(string a, string b)
        {
            if (a.Length != b.Length) return false;
            return CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(a),
                Encoding.ASCII.GetBytes(b));
        }

        private static string BuildHtmlBody(string code)
        {
            return $@"
<div style=""font-family:Arial,sans-serif;color:#0f172a;max-width:480px;margin:0 auto;padding:24px;"">
  <h2 style=""color:#0f172a;margin:0 0 12px;"">FinTreX - Email Doğrulama</h2>
  <p style=""color:#475569;line-height:1.6;"">Merhaba,</p>
  <p style=""color:#475569;line-height:1.6;"">FinTreX hesabını doğrulamak için aşağıdaki 6 haneli kodu uygulamaya gir:</p>
  <div style=""margin:24px 0;padding:16px 24px;background:#f1f5f9;border-radius:12px;text-align:center;font-size:28px;font-weight:700;letter-spacing:8px;color:#0f172a;"">
    {code}
  </div>
  <p style=""color:#64748b;font-size:13px;line-height:1.6;"">Kod 10 dakika boyunca geçerlidir. Bu işlemi sen başlatmadıysan bu maili dikkate almayabilirsin.</p>
  <p style=""color:#94a3b8;font-size:12px;margin-top:24px;"">— FinTreX</p>
</div>";
        }
    }
}
