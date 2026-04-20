using FinTreX.Core.DTOs.Account;
using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly IAccountService _accountService;

        public AccountController(IAccountService accountService)
        {
            _accountService = accountService;
        }

        /// <summary>Authenticate with email + password → JWT + refresh token.</summary>
        [HttpPost("authenticate")]
        public async Task<IActionResult> AuthenticateAsync(AuthenticationRequest request)
        {
            var response = await _accountService.AuthenticateAsync(request, GenerateIPAddress());
            SetRefreshTokenCookie(response.RefreshToken);
            return Ok(response);
        }

        /// <summary>Register a new user account. Triggers an OTP email and requires subsequent verification.</summary>
        [HttpPost("register")]
        public async Task<IActionResult> RegisterAsync(RegisterRequest request)
        {
            var origin = Request.Headers["origin"];
            return Ok(await _accountService.RegisterAsync(request, origin));
        }

        /// <summary>Verify the 6-digit email OTP and receive a JWT + refresh token.</summary>
        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmailAsync(VerifyEmailRequest request)
        {
            var response = await _accountService.VerifyEmailAsync(request, GenerateIPAddress());
            SetRefreshTokenCookie(response.RefreshToken);
            return Ok(response);
        }

        /// <summary>Resend the 6-digit email verification code (60-second cooldown).</summary>
        [HttpPost("resend-verification-code")]
        public async Task<IActionResult> ResendVerificationCodeAsync(ResendVerificationRequest request)
        {
            await _accountService.ResendVerificationCodeAsync(request);
            return Ok(new { message = "Doğrulama kodu email adresine gönderildi." });
        }

        /// <summary>Exchange a refresh token for a new JWT + refresh token pair.</summary>
        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshTokenAsync([FromBody] RefreshTokenRequest request)
        {
            // Try cookie first, then body
            var refreshToken = Request.Cookies["refreshToken"] ?? request?.Token;
            if (string.IsNullOrWhiteSpace(refreshToken))
                return BadRequest(new { message = "Refresh token is required." });

            var response = await _accountService.RefreshTokenAsync(refreshToken, GenerateIPAddress());
            SetRefreshTokenCookie(response.RefreshToken);
            return Ok(response);
        }

        /// <summary>Revoke a refresh token (e.g. on logout).</summary>
        [HttpPost("revoke-token")]
        public async Task<IActionResult> RevokeTokenAsync([FromBody] RefreshTokenRequest request)
        {
            var token = Request.Cookies["refreshToken"] ?? request?.Token;
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest(new { message = "Token is required." });

            await _accountService.RevokeTokenAsync(token, GenerateIPAddress());
            ClearRefreshTokenCookie();
            return Ok(new { message = "Token revoked." });
        }

        /// <summary>Request a password reset token.</summary>
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            var result = await _accountService.ForgotPasswordAsync(request);
            return Ok(new { message = result });
        }

        /// <summary>Reset password using a valid reset token.</summary>
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPasswordAsync(ResetPasswordRequest request)
        {
            var result = await _accountService.ResetPasswordAsync(request);
            return Ok(new { message = result });
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        private void SetRefreshTokenCookie(string token)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = System.DateTimeOffset.UtcNow.AddDays(7)
            };
            Response.Cookies.Append("refreshToken", token, cookieOptions);
        }

        private void ClearRefreshTokenCookie()
        {
            Response.Cookies.Delete("refreshToken");
        }

        private string GenerateIPAddress()
        {
            if (Request.Headers.ContainsKey("X-Forwarded-For"))
                return Request.Headers["X-Forwarded-For"];
            else
                return HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        }
    }
}