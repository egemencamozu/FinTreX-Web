using FinTreX.Core.Interfaces;
using System.Collections.Generic;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using Asp.Versioning;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    [ApiVersion("1.0")]
    public class UserManagementController : BaseApiController
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IUserManagementService _userManagementService;

        public UserManagementController(UserManager<ApplicationUser> userManager, IUserManagementService userManagementService)
        {
            _userManager = userManager;
            _userManagementService = userManagementService;
        }
        
        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userSummary = await _userManagementService.GetUserByIdAsync(AuthenticatedUserId);
            return Ok(userSummary);
        }

        [HttpGet("users")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userManager.Users.ToListAsync();
            var userSummaries = new List<object>();

            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                userSummaries.Add(new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.UserName,
                    user.EmailConfirmed,
                    IsActive = user.EmailConfirmed, // Use this for now
                    Role = roles.FirstOrDefault() ?? "User"
                });
            }

            return Ok(userSummaries);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUserById(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null) return NotFound();

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.UserName,
                user.EmailConfirmed,
                Roles = roles
            });
        }

        [HttpPost("{id}/activate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ActivateUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null) return NotFound();

            user.EmailConfirmed = true; // Use this as 'Active' status
            await _userManager.UpdateAsync(user);

            return Ok(new { Message = "User activated successfully" });
        }

        [HttpPost("{id}/deactivate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeactivateUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null) return NotFound();

            user.EmailConfirmed = false; // Use this as 'Active' status
            await _userManager.UpdateAsync(user);

            return Ok(new { Message = "User deactivated successfully" });
        }
    }
}
