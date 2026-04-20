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

        public async Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress)
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

            return await BuildAuthenticationResponseAsync(user, ipAddress);
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

        public async Task<AuthenticationResponse> VerifyEmailAsync(VerifyEmailRequest request, string ipAddress)
        {
            await _emailVerificationService.VerifyAsync(request.Email, request.Code);


            var user = await _userManager.FindByEmailAsync(request.Email)
                ?? throw new ApiException($"No account found for {request.Email}.");

            return await BuildAuthenticationResponseAsync(user, ipAddress);
        }

        public async Task ResendVerificationCodeAsync(ResendVerificationRequest request)
        {
            await _emailVerificationService.ResendAsync(request.Email);
        }

        // ════════════════════════════════════════════════════════════════════
        // REFRESH TOKEN
        // ════════════════════════════════════════════════════════════════════

        public async Task<AuthenticationResponse> RefreshTokenAsync(string token, string ipAddress)
        {
            var user = await _dbContext.Users
                .Include(u => u.RefreshTokens)
                .SingleOrDefaultAsync(u => u.RefreshTokens.Any(t => t.Token == token));

            if (user == null)
                throw new ApiException("Invalid token.");

            var refreshToken = user.RefreshTokens.Single(t => t.Token == token);

            if (!refreshToken.IsActive)
                throw new ApiException("Token is expired or revoked.");

            // Rotate: revoke old, create new
            var newRefreshToken = GenerateRefreshToken(ipAddress);
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
        // PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        private async Task<AuthenticationResponse> BuildAuthenticationResponseAsync(ApplicationUser user, string ipAddress)
        {
            JwtSecurityToken jwtSecurityToken = await GenerateJWToken(user);
            var role = await GetSingleRoleOrThrowAsync(user);

            // Generate refresh token & persist
            var refreshToken = GenerateRefreshToken(ipAddress);
            user.RefreshTokens ??= new List<RefreshToken>();
            user.RefreshTokens.Add(refreshToken);

            RemoveOldRefreshTokens(user);

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

        private static RefreshToken GenerateRefreshToken(string ipAddress)
        {
            return new RefreshToken
            {
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                Expires = DateTime.UtcNow.AddDays(7),
                Created = DateTime.UtcNow,
                CreatedByIp = ipAddress
            };
        }

        private static void RemoveOldRefreshTokens(ApplicationUser user)
        {
            // Keep only last 5 active + recently revoked tokens
            user.RefreshTokens?.RemoveAll(t =>
                !t.IsActive && t.Created.AddDays(2) <= DateTime.UtcNow);
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
                new Claim("ip", ipAddress)
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
