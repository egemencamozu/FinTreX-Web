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

        public MeController(IUserManagementService userManagementService)
        {
            _userManagementService = userManagementService;
        }

        /// <summary>
        /// Returns the currently authenticated user's profile.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMyProfile()
        {
            var user = await _userManagementService.GetUserByIdAsync(AuthenticatedUserId);
            return Ok(user);
        }
    }
}

//Bu bir deneme commitidir.
