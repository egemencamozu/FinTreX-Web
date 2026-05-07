using FinTreX.Core.DTOs.Account;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Contexts;
using FinTreX.Infrastructure.Helpers;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class AccountService : IAccountService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly JWTSettings _jwtSettings;
        private readonly PasswordResetSettings _passwordResetSettings;
        private readonly ApplicationDbContext _dbContext;
        private readonly IEmailService _emailService;
        private readonly IEmailVerificationService _emailVerificationService;

        public AccountService(
            UserManager<ApplicationUser> userManager,
            IOptions<JWTSettings> jwtSettings,
            SignInManager<ApplicationUser> signInManager,
            ApplicationDbContext dbContext,
            IOptions<PasswordResetSettings> passwordResetSettings,
            IEmailService emailService,
            IEmailVerificationService emailVerificationService)
        {
            _userManager = userManager;
            _jwtSettings = jwtSettings.Value;
            _signInManager = signInManager;
            _dbContext = dbContext;
            _passwordResetSettings = passwordResetSettings.Value;
            _emailService = emailService;
            _emailVerificationService = emailVerificationService;
        }

        // ════════════════════════════════════════════════════════════════════
        // AUTHENTICATE
        // ════════════════════════════════════════════════════════════════════

        public async Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress, string userAgent)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
                throw new ApiException($"No Accounts Registered with {request.Email}.");

            var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
            if (lockoutEnd.HasValue && lockoutEnd.Value > DateTimeOffset.UtcNow)
                throw new ApiException(BuildDeactivatedAccountMessage(lockoutEnd.Value));

            var result = await _signInManager.PasswordSignInAsync(user.UserName, request.Password, false, lockoutOnFailure: false);
            if (result.IsLockedOut)
            {
                var lockedUntil = await _userManager.GetLockoutEndDateAsync(user);
                throw new ApiException(BuildDeactivatedAccountMessage(lockedUntil ?? DateTimeOffset.MaxValue));
            }

            if (!result.Succeeded)
                throw new ApiException($"Invalid Credentials for '{request.Email}'.");

            if (!user.EmailConfirmed)
            {
                try
                {
                    await _emailVerificationService.ResendAsync(request.Email);
                }
                catch (ApiException)
                {
                    // Cooldown henüz bitmemişse veya başka bir doğrulama-mesaj durumu
                    // varsa yeni mail atmayız; kullanıcı modalı açıp mevcut kodu
                    // girmeye devam edebilir.
                }

                throw new EmailNotConfirmedException(
                    request.Email,
                    "Email adresiniz doğrulanmamış. Gönderilen doğrulama kodunu girin.");
            }

            return await BuildAuthenticationResponseAsync(user, ipAddress, userAgent);
        }

        // ════════════════════════════════════════════════════════════════════
        // REGISTER
        // ════════════════════════════════════════════════════════════════════

        public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, string origin)
        {
            var userName = await GenerateUniqueUserNameAsync(request.UserName, request.Email);
            var userWithSameUserName = await _userManager.FindByNameAsync(userName);
            if (userWithSameUserName != null)
                throw new ApiException($"Username '{userName}' is already taken.");

            var roleName = ResolveRegistrationRole(request.Role);
            var user = new ApplicationUser
            {
                Email = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                PhoneNumber = request.PhoneNumber,
                UserName = userName,
                EmailConfirmed = false
            };

            var userWithSameEmail = await _userManager.FindByEmailAsync(request.Email);
            if (userWithSameEmail != null)
                throw new ApiException($"Email {request.Email} is already registered.");

            var createResult = await _userManager.CreateAsync(user, request.Password);
            if (!createResult.Succeeded)
                throw new ApiException(string.Join(" ", createResult.Errors.Select(e => e.Description)));

            var addToRoleResult = await _userManager.AddToRoleAsync(user, roleName);
            if (!addToRoleResult.Succeeded)
                throw new ApiException(string.Join(" ", addToRoleResult.Errors.Select(e => e.Description)));

            // Assign the Default subscription plan to every new User
            if (roleName == Roles.User.ToString())
            {
                var defaultPlan = await _dbContext.Set<SubscriptionPlan>()
                    .FirstOrDefaultAsync(p => p.Tier == SubscriptionTier.Default && p.IsActive);

                if (defaultPlan != null)
                {
                    _dbContext.Set<UserSubscription>().Add(new UserSubscription
                    {
                        ApplicationUserId = user.Id,
                        SubscriptionPlanId = defaultPlan.Id,
                        Status = SubscriptionStatus.Active,
                        StartedAtUtc = DateTime.UtcNow,
                    });
                    await _dbContext.SaveChangesAsync();
                }

                // Auto-assign a random economist to Default-plan users at registration
                var economists = await _userManager.GetUsersInRoleAsync(Roles.Economist.ToString());
                if (economists.Count > 0)
                {
                    var picked = economists[new Random().Next(economists.Count)];
                    _dbContext.Set<EconomistClient>().Add(new EconomistClient
                    {
                        ClientId = user.Id,
                        EconomistId = picked.Id,
                        AssignedAtUtc = DateTime.UtcNow,
                        IsActive = true,
                    });
                    await _dbContext.SaveChangesAsync();
                }
            }

            // Fire off the OTP email. A failure here is surfaced to the client so
            // they know to retry via /resend-verification-code instead of being
            // silently locked out.
            await _emailVerificationService.GenerateAndSendAsync(user.Id, user.Email);

            return new RegisterResponse
            {
                Success = true,
                RequiresVerification = true,
                Email = user.Email,
                Message = "Doğrulama kodu email adresine gönderildi."
            };
        }

        // ════════════════════════════════════════════════════════════════════
        // VERIFY EMAIL (OTP)
        // ════════════════════════════════════════════════════════════════════

        public async Task<AuthenticationResponse> VerifyEmailAsync(VerifyEmailRequest request, string ipAddress, string userAgent)
        {
            await _emailVerificationService.VerifyAsync(request.Email, request.Code);


            var user = await _userManager.FindByEmailAsync(request.Email)
                ?? throw new ApiException($"No account found for {request.Email}.");

            return await BuildAuthenticationResponseAsync(user, ipAddress, userAgent);
        }

        public async Task ResendVerificationCodeAsync(ResendVerificationRequest request)
        {
            await _emailVerificationService.ResendAsync(request.Email);
        }

        // ════════════════════════════════════════════════════════════════════
        // REFRESH TOKEN
        // ════════════════════════════════════════════════════════════════════

        public async Task<AuthenticationResponse> RefreshTokenAsync(string token, string ipAddress, string userAgent)
        {
            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.RefreshTokens.Any(t => t.Token == token));

            if (user == null)
                throw new ApiException("Invalid token.");

            var refreshToken = user.RefreshTokens.Single(t => t.Token == token);

            if (!refreshToken.IsActive)
                throw new ApiException("Token is expired or revoked.");

            var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
            if (lockoutEnd.HasValue && lockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                RevokeActiveRefreshTokens(user, ipAddress);
                await _dbContext.SaveChangesAsync();
                throw new ApiException(BuildDeactivatedAccountMessage(lockoutEnd.Value));
            }

            // Rotate: revoke old, create new. Preserve device metadata across rotation.
            var carriedUserAgent = string.IsNullOrWhiteSpace(userAgent) ? refreshToken.UserAgent : userAgent;
            var newRefreshToken = GenerateRefreshToken(ipAddress, carriedUserAgent);
            refreshToken.Revoked = DateTime.UtcNow;
            refreshToken.RevokedByIp = ipAddress;
            refreshToken.ReplacedByToken = newRefreshToken.Token;

            user.RefreshTokens.Add(newRefreshToken);

            // Clean up old tokens (keep last 5)
            RemoveOldRefreshTokens(user);

            await _dbContext.SaveChangesAsync();

            // Generate new JWT
            JwtSecurityToken jwtSecurityToken = await GenerateJWToken(user);
            var role = await GetSingleRoleOrThrowAsync(user);

            return new AuthenticationResponse
            {
                Id = user.Id,
                JWToken = new JwtSecurityTokenHandler().WriteToken(jwtSecurityToken),
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                UserName = user.UserName,
                Role = role,
                IsVerified = user.EmailConfirmed,
                RefreshToken = newRefreshToken.Token,
                RefreshTokenExpiration = newRefreshToken.Expires
            };
        }

        // ════════════════════════════════════════════════════════════════════
        // REVOKE TOKEN (e.g. on logout)
        // ════════════════════════════════════════════════════════════════════

        public async Task RevokeTokenAsync(string token, string ipAddress)
        {
            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.RefreshTokens.Any(t => t.Token == token));

            if (user == null)
                throw new ApiException("Invalid token.");

            var refreshToken = user.RefreshTokens.Single(t => t.Token == token);

            if (!refreshToken.IsActive)
                throw new ApiException("Token is already revoked or expired.");

            refreshToken.Revoked = DateTime.UtcNow;
            refreshToken.RevokedByIp = ipAddress;

            await _dbContext.SaveChangesAsync();
        }

        // ════════════════════════════════════════════════════════════════════
        // FORGOT PASSWORD
        // ════════════════════════════════════════════════════════════════════

        public async Task<string> ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                // Do not reveal that the user does not exist
                return "If the email is registered, you will receive a password reset link.";
            }

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetUrl = BuildPasswordResetUrl(user.Email, resetToken);
            var subject = "FinTreX - Password Reset";
            var body = $@"
<p>Merhaba,</p>
<p>Sifrenizi sifirlamak icin asagidaki baglantiya tiklayin:</p>
<p><a href=""{resetUrl}"">Sifremi Sifirla</a></p>
<p>Bu islemi siz baslatmadiysaniz bu maili dikkate almayin.</p>";

            try
            {
                await _emailService.SendAsync(user.Email, subject, body);
            }
            catch (ApiException)
            {
                throw;
            }
            catch (Exception ex)
            {
                var reason = ex.InnerException?.Message ?? ex.Message;
                throw new ApiException($"Password reset email could not be sent. {reason}");
            }

            return "If the email is registered, you will receive a password reset link.";
        }

        // ════════════════════════════════════════════════════════════════════
        // RESET PASSWORD
        // ════════════════════════════════════════════════════════════════════

        public async Task<string> ResetPasswordAsync(ResetPasswordRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
                throw new ApiException("Invalid request.");

            if (request.Password != request.ConfirmPassword)
                throw new ApiException("Passwords do not match.");

            var result = await _userManager.ResetPasswordAsync(user, request.Token, request.Password);
            if (!result.Succeeded)
                throw new ApiException(string.Join(" ", result.Errors.Select(e => e.Description)));

            return "Password has been reset successfully.";
        }

        // ════════════════════════════════════════════════════════════════════
        // CHANGE PASSWORD (authenticated)
        // ════════════════════════════════════════════════════════════════════

        public async Task ChangePasswordAsync(string userId, ChangePasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ApiException("User context missing.");

            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            if (request.NewPassword != request.ConfirmNewPassword)
                throw new ApiException("Yeni şifreler eşleşmiyor.");

            if (request.CurrentPassword == request.NewPassword)
                throw new ApiException("Yeni şifre mevcut şifre ile aynı olamaz.");

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!result.Succeeded)
                throw new ApiException(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        // ════════════════════════════════════════════════════════════════════
        // SESSIONS (active refresh tokens)
        // ════════════════════════════════════════════════════════════════════

        public async Task<IReadOnlyList<SessionDto>> GetSessionsAsync(string userId, string currentToken)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ApiException("User context missing.");

            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.Id == userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            var now = DateTime.UtcNow;
            return user.RefreshTokens
                .Where(t => t.Revoked == null && t.Expires > now)
                .OrderByDescending(t => t.Created)
                .Select(t => new SessionDto
                {
                    Id = t.Id,
                    DeviceName = t.DeviceName ?? "Bilinmeyen Cihaz",
                    UserAgent = t.UserAgent,
                    IpAddress = t.CreatedByIp,
                    CreatedAt = t.Created,
                    ExpiresAt = t.Expires,
                    IsCurrent = !string.IsNullOrEmpty(currentToken) && t.Token == currentToken
                })
                .ToList();
        }

        public async Task RevokeSessionAsync(string userId, int sessionId, string ipAddress)
        {
            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.Id == userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            var session = user.RefreshTokens.FirstOrDefault(t => t.Id == sessionId)
                ?? throw new ApiException("Oturum bulunamadı.");

            if (!session.IsActive)
                throw new ApiException("Oturum zaten sonlandırılmış.");

            session.Revoked = DateTime.UtcNow;
            session.RevokedByIp = ipAddress;

            await _dbContext.SaveChangesAsync();
        }

        // ════════════════════════════════════════════════════════════════════
        // DELETE MY ACCOUNT
        // ════════════════════════════════════════════════════════════════════

        public async Task SendDeletionCodeAsync(string userId, string password)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            var isPasswordValid = await _userManager.CheckPasswordAsync(user, password);
            if (!isPasswordValid)
                throw new ApiException("Şifre hatalı.");

            // Reuse OTP infrastructure — generate & send a fresh code
            await _emailVerificationService.GenerateAndSendDeletionCodeAsync(user.Id, user.Email);
        }

        public async Task DeleteMyAccountAsync(string userId, DeleteAccountRequest request)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
            if (!isPasswordValid)
                throw new ApiException("Şifre hatalı.");

            await _emailVerificationService.VerifyDeletionCodeAsync(user.Id, request.VerificationCode);

            // Cancel active Stripe subscription if present
            var activeSubscription = await _dbContext.Set<UserSubscription>()
                .FirstOrDefaultAsync(s => s.ApplicationUserId == userId
                    && s.Status == SubscriptionStatus.Active
                    && s.StripeSubscriptionId != null);

            if (activeSubscription != null)
            {
                try
                {
                    var stripeService = new Stripe.SubscriptionService();
                    await stripeService.CancelAsync(activeSubscription.StripeSubscriptionId,
                        new Stripe.SubscriptionCancelOptions { InvoiceNow = false, Prorate = false });
                }
                catch
                {
                    // Best-effort — don't block account deletion on Stripe failure
                }
            }

            var economistAssignments = await _dbContext.Set<EconomistClient>()
                .Where(ec => ec.ClientId == userId || ec.EconomistId == userId)
                .ToListAsync();
            if (economistAssignments.Any())
            {
                _dbContext.Set<EconomistClient>().RemoveRange(economistAssignments);
            }

            var consultancyTasks = await _dbContext.Set<ConsultancyTask>()
                .Where(t => t.UserId == userId || t.EconomistId == userId)
                .ToListAsync();
            if (consultancyTasks.Any())
            {
                _dbContext.Set<ConsultancyTask>().RemoveRange(consultancyTasks);
            }

            var relatedConversationIds = await _dbContext.Set<Conversation>()
                .Where(c => c.CreatedByUserId == userId)
                .Select(c => c.Id)
                .Union(
                    _dbContext.Set<ConversationParticipant>()
                        .Where(p => p.UserId == userId)
                        .Select(p => p.ConversationId)
                )
                .Distinct()
                .ToListAsync();
            if (relatedConversationIds.Any())
            {
                var relatedConversations = await _dbContext.Set<Conversation>()
                    .Where(c => relatedConversationIds.Contains(c.Id))
                    .ToListAsync();
                _dbContext.Set<Conversation>().RemoveRange(relatedConversations);
            }

            var aiConversations = await _dbContext.Set<AiConversation>()
                .Where(c => c.UserId == userId)
                .ToListAsync();
            if (aiConversations.Any())
            {
                _dbContext.Set<AiConversation>().RemoveRange(aiConversations);
            }

            var handledTickets = await _dbContext.Set<SupportTicket>()
                .Where(t => t.HandledByAdminId == userId)
                .ToListAsync();
            foreach (var ticket in handledTickets)
            {
                ticket.HandledByAdminId = null;
            }

            await _dbContext.SaveChangesAsync();

            var deleteResult = await _userManager.DeleteAsync(user);
            if (!deleteResult.Succeeded)
                throw new ApiException(string.Join(" ", deleteResult.Errors.Select(e => e.Description)));
        }

        public async Task RevokeOtherSessionsAsync(string userId, string currentToken, string ipAddress)
        {
            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.Id == userId)
                ?? throw new ApiException("Kullanıcı bulunamadı.");

            var now = DateTime.UtcNow;
            foreach (var token in user.RefreshTokens.Where(t => t.Revoked == null && t.Expires > now))
            {
                if (!string.IsNullOrEmpty(currentToken) && token.Token == currentToken)
                    continue;

                token.Revoked = now;
                token.RevokedByIp = ipAddress;
            }

            await _dbContext.SaveChangesAsync();
        }

        // ════════════════════════════════════════════════════════════════════
        // PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        private async Task<AuthenticationResponse> BuildAuthenticationResponseAsync(ApplicationUser user, string ipAddress, string userAgent)
        {
            // Ensure RefreshTokens are loaded or initialized
            if (user.RefreshTokens == null)
            {
               // If we want to be safe, we could load them, but usually they are loaded if the user was just fetched 
               // and the navigation property is configured correctly.
               // However, for safety in this refactored state:
               user.RefreshTokens = await _dbContext.Users
                   .Where(u => u.Id == user.Id)
                   .SelectMany(u => u.RefreshTokens)
                   .ToListAsync() ?? new List<RefreshToken>();
            }

            JwtSecurityToken jwtSecurityToken = await GenerateJWToken(user);
            var role = await GetSingleRoleOrThrowAsync(user);

            // Generate refresh token & persist
            var refreshToken = GenerateRefreshToken(ipAddress, userAgent);
            user.RefreshTokens.Add(refreshToken);

            RemoveOldRefreshTokens(user);

            user.LastLoginAt = DateTimeOffset.UtcNow;
            _dbContext.Update(user);
            await _dbContext.SaveChangesAsync();

            return new AuthenticationResponse
            {
                Id = user.Id,
                JWToken = new JwtSecurityTokenHandler().WriteToken(jwtSecurityToken),
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                UserName = user.UserName,
                Role = role,
                IsVerified = user.EmailConfirmed,
                RefreshToken = refreshToken.Token,
                RefreshTokenExpiration = refreshToken.Expires
            };
        }

        private static RefreshToken GenerateRefreshToken(string ipAddress, string userAgent)
        {
            var trimmedUa = string.IsNullOrWhiteSpace(userAgent) ? null : userAgent.Trim();
            return new RefreshToken
            {
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                Expires = DateTime.UtcNow.AddDays(7),
                Created = DateTime.UtcNow,
                CreatedByIp = ipAddress,
                UserAgent = trimmedUa?.Length > 512 ? trimmedUa[..512] : trimmedUa,
                DeviceName = ParseDeviceName(trimmedUa)
            };
        }

        /// <summary>Best-effort parse of a User-Agent into a "Browser on OS" label.</summary>
        private static string ParseDeviceName(string userAgent)
        {
            if (string.IsNullOrWhiteSpace(userAgent)) return "Bilinmeyen Cihaz";

            var ua = userAgent;
            string browser =
                ua.Contains("Edg/", StringComparison.OrdinalIgnoreCase) ? "Edge" :
                ua.Contains("OPR/", StringComparison.OrdinalIgnoreCase) || ua.Contains("Opera", StringComparison.OrdinalIgnoreCase) ? "Opera" :
                ua.Contains("Firefox", StringComparison.OrdinalIgnoreCase) ? "Firefox" :
                ua.Contains("Chrome", StringComparison.OrdinalIgnoreCase) ? "Chrome" :
                ua.Contains("Safari", StringComparison.OrdinalIgnoreCase) ? "Safari" :
                "Tarayıcı";

            string os =
                ua.Contains("Windows", StringComparison.OrdinalIgnoreCase) ? "Windows" :
                ua.Contains("Android", StringComparison.OrdinalIgnoreCase) ? "Android" :
                ua.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ? "iPhone" :
                ua.Contains("iPad", StringComparison.OrdinalIgnoreCase) ? "iPad" :
                ua.Contains("Mac OS", StringComparison.OrdinalIgnoreCase) ? "macOS" :
                ua.Contains("Linux", StringComparison.OrdinalIgnoreCase) ? "Linux" :
                "Bilinmeyen";

            return $"{browser} · {os}";
        }

        private static void RemoveOldRefreshTokens(ApplicationUser user)
        {
            // Keep only last 5 active + recently revoked tokens
            user.RefreshTokens?.RemoveAll(t =>
                !t.IsActive && t.Created.AddDays(2) <= DateTime.UtcNow);
        }

        private static void RevokeActiveRefreshTokens(ApplicationUser user, string ipAddress)
        {
            var now = DateTime.UtcNow;
            foreach (var token in user.RefreshTokens.Where(t => t.Revoked == null && t.Expires > now))
            {
                token.Revoked = now;
                token.RevokedByIp = ipAddress;
            }
        }

        private static string ResolveRegistrationRole(string requestedRole)
        {
            if (string.IsNullOrWhiteSpace(requestedRole))
                throw new ApiException("Role is required.");

            return requestedRole.Trim().ToUpperInvariant() switch
            {
                "USER" => Roles.User.ToString(),
                "ECONOMIST" => Roles.Economist.ToString(),
                "ADMIN" => throw new ApiException("Admin role cannot be assigned during self-registration."),
                _ => throw new ApiException($"Unsupported role '{requestedRole}'.")
            };
        }

        private async Task<string> GenerateUniqueUserNameAsync(string requestedUserName, string email)
        {
            var baseUserNameSource = string.IsNullOrWhiteSpace(requestedUserName)
                ? email?.Split('@').FirstOrDefault()
                : requestedUserName;

            var sanitizedBaseUserName = new string((baseUserNameSource ?? string.Empty)
                .Trim()
                .Where(char.IsLetterOrDigit)
                .ToArray());

            if (string.IsNullOrWhiteSpace(sanitizedBaseUserName))
                throw new ApiException("A valid username could not be generated from the provided data.");

            var candidate = sanitizedBaseUserName;
            var suffix = 1;

            while (await _userManager.FindByNameAsync(candidate) != null)
            {
                candidate = $"{sanitizedBaseUserName}{suffix}";
                suffix++;
            }

            return candidate;
        }

        private async Task<JwtSecurityToken> GenerateJWToken(ApplicationUser user)
        {
            var userClaims = await _userManager.GetClaimsAsync(user);
            var role = await GetSingleRoleOrThrowAsync(user);

            var roleClaims = new[] { new Claim(ClaimTypes.Role, role) };

            string ipAddress = IpHelper.GetIpAddress();

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("uid", user.Id),
                new Claim("ip", ipAddress),
                new Claim("economist_status", user.EconomistStatus.ToString())
            }
            .Union(userClaims)
            .Union(roleClaims);

            var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            var signingCredentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256);

            return new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtSettings.DurationInMinutes),
                signingCredentials: signingCredentials);
        }

        private string BuildPasswordResetUrl(string email, string resetToken)
        {
            if (string.IsNullOrWhiteSpace(_passwordResetSettings.ResetPageUrl))
                throw new ApiException("Password reset page URL is not configured.");

            var encodedEmail = Uri.EscapeDataString(email);
            var encodedToken = Uri.EscapeDataString(resetToken);
            return $"{_passwordResetSettings.ResetPageUrl}?email={encodedEmail}&token={encodedToken}";
        }

        private static string BuildDeactivatedAccountMessage(DateTimeOffset lockoutEnd)
        {
            if (lockoutEnd >= DateTimeOffset.MaxValue.AddDays(-1))
                return "Hesabiniz suresiz olarak deactive edilmistir.";

            var remaining = lockoutEnd - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero)
                return "Hesabiniz deactive durumdadir. Lutfen daha sonra tekrar deneyin.";

            return $"Hesabiniz deactive edilmistir. Kalan sure: {FormatRemaining(remaining)}.";
        }

        private static string FormatRemaining(TimeSpan remaining)
        {
            if (remaining.TotalDays >= 30)
                return $"{Math.Ceiling(remaining.TotalDays / 30)} ay";

            if (remaining.TotalDays >= 1)
                return $"{Math.Ceiling(remaining.TotalDays)} gun";

            if (remaining.TotalHours >= 1)
                return $"{Math.Ceiling(remaining.TotalHours)} saat";

            return $"{Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes))} dakika";
        }

        private async Task<string> GetSingleRoleOrThrowAsync(ApplicationUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Count != 1)
                throw new ApiException($"User '{user.Email}' must have exactly one role. Found: {roles.Count}.");

            return roles[0];
        }
    }
}
