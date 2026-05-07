using FinTreX.Core.DTOs.Account;
using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    /// <summary>
    /// Authenticated-user controller — any logged-in user can access their own profile.
    /// Protected by [Authorize] (no specific role required).
    /// </summary>
    [Authorize]
    public class MeController : BaseApiController
    {
        private readonly IUserManagementService _userManagementService;
        private readonly IAccountService _accountService;

        public MeController(IUserManagementService userManagementService, IAccountService accountService)
        {
            _userManagementService = userManagementService;
            _accountService = accountService;
        }

        /// <summary>Returns the currently authenticated user's profile.</summary>
        [HttpGet]
        public async Task<IActionResult> GetMyProfile()
        {
            var user = await _userManagementService.GetUserByIdAsync(AuthenticatedUserId);
            return Ok(user);
        }

        /// <summary>
        /// Step 1 of account deletion: verify password and send a 6-digit OTP to the user's email.
        /// </summary>
        [HttpPost("deletion-code")]
        public async Task<IActionResult> RequestDeletionCode([FromBody] RequestDeletionCodeDto request)
        {
            await _accountService.SendDeletionCodeAsync(AuthenticatedUserId, request.Password);
            return Ok(new { message = "Hesap silme doğrulama kodu e-posta adresinize gönderildi." });
        }

        /// <summary>
        /// Step 2 of account deletion: verify OTP, cancel subscriptions, permanently delete account.
        /// </summary>
        [HttpDelete]
        public async Task<IActionResult> DeleteMyAccount([FromBody] DeleteAccountRequest request)
        {
            await _accountService.DeleteMyAccountAsync(AuthenticatedUserId, request);
            return Ok(new { message = "Hesabınız başarıyla silindi." });
        }
    }
}
