using FinTreX.Core.DTOs.Account;
using FinTreX.Core.Interfaces;
using System.Collections.Generic;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Asp.Versioning;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    [ApiVersion("1.0")]
    public class UserManagementController : BaseApiController
    {
        private readonly IUserManagementService _userManagementService;

        public UserManagementController(IUserManagementService userManagementService)
        {
            _userManagementService = userManagementService;
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userSummary = await _userManagementService.GetUserByIdAsync(AuthenticatedUserId);
            return Ok(userSummary);
        }

        [HttpGet("stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminStats()
        {
            var stats = await _userManagementService.GetAdminStatsAsync();
            return Ok(stats);
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileDto request)
        {
            var updated = await _userManagementService.UpdateMyProfileAsync(AuthenticatedUserId, request);
            return Ok(updated);
        }

        [HttpGet("users")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userManagementService.GetAllUsersAsync();
            return Ok(users);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUserById(string id)
        {
            var user = await _userManagementService.GetUserByIdAsync(id);
            return Ok(user);
        }

        [HttpPost("{id}/activate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ActivateUser(string id)
        {
            var message = await _userManagementService.ActivateUserAsync(id);
            return Ok(new { Message = message });
        }

        [HttpPost("bulk-deactivate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkDeactivate([FromBody] BulkDeactivateDto dto)
        {
            var result = await _userManagementService.BulkDeactivateAsync(dto.UserIds, dto.DurationKey);
            return Ok(result);
        }

        [HttpPost("bulk-activate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkActivate([FromBody] BulkActivateDto dto)
        {
            var result = await _userManagementService.BulkActivateAsync(dto.UserIds);
            return Ok(result);
        }

        public class DeactivateRequest
        {
            public string DurationKey { get; set; }
        }

        [HttpPost("{id}/deactivate")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeactivateUser(string id, [FromBody] DeactivateRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.DurationKey))
            {
                return BadRequest("DurationKey is required (e.g. ONE_HOUR, ONE_DAY, ONE_WEEK).");
            }
            
            var message = await _userManagementService.DeactivateUserAsync(id, request.DurationKey);
            return Ok(new { Message = message });
        }
    }
}
