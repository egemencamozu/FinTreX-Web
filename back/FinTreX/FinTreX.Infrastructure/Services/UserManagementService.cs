using FinTreX.Core.DTOs.Account;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    /// <summary>
    /// Implements admin-level user management operations.
    /// Depends only on ASP.NET Identity abstractions (DIP).
    /// </summary>
    public class UserManagementService : IUserManagementService
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public UserManagementService(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        public async Task<IReadOnlyList<UserSummaryDto>> GetAllUsersAsync()
        {
            var users = await _userManager.Users
                .AsNoTracking()
                .OrderBy(u => u.Email)
                .ToListAsync();

            var result = new List<UserSummaryDto>(users.Count);

            foreach (var user in users)
            {
                var role = await GetSingleRoleAsync(user);
                result.Add(MapToSummary(user, role));
            }

            return result.AsReadOnly();
        }

        public async Task<UserSummaryDto> GetUserByIdAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                throw new ApiException($"User with ID '{userId}' was not found.");
            }

            var role = await GetSingleRoleAsync(user);
            return MapToSummary(user, role);
        }

        public async Task<string> DeactivateUserAsync(string userId, string durationKey)
        {
            var user = await _userManager.FindByIdAsync(userId)
                       ?? throw new ApiException($"User with ID '{userId}' was not found.");

            var targetRole = await GetSingleRoleAsync(user);
            if (string.Equals(targetRole, Roles.Admin.ToString(), StringComparison.OrdinalIgnoreCase))
                throw new ApiException("Admin hesaplari deactive edilemez.");

            var lockoutEnd = ResolveLockoutEnd(durationKey);

            var setLockoutEnabledResult = await _userManager.SetLockoutEnabledAsync(user, true);
            if (!setLockoutEnabledResult.Succeeded)
                throw new ApiException(string.Join(" ", setLockoutEnabledResult.Errors.Select(e => e.Description)));

            var setLockoutEndResult = await _userManager.SetLockoutEndDateAsync(user, lockoutEnd);
            if (!setLockoutEndResult.Succeeded)
                throw new ApiException(string.Join(" ", setLockoutEndResult.Errors.Select(e => e.Description)));

            var durationText = lockoutEnd >= DateTimeOffset.MaxValue.AddDays(-1)
                ? "suresiz"
                : lockoutEnd.ToString("yyyy-MM-dd HH:mm:ss");

            return $"User '{user.Email}' deactive edildi. Bitis: {durationText}.";
        }

        public async Task<string> ActivateUserAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId)
                       ?? throw new ApiException($"User with ID '{userId}' was not found.");

            var setLockoutEndResult = await _userManager.SetLockoutEndDateAsync(user, null);
            if (!setLockoutEndResult.Succeeded)
                throw new ApiException(string.Join(" ", setLockoutEndResult.Errors.Select(e => e.Description)));

            var resetAccessFailedCountResult = await _userManager.ResetAccessFailedCountAsync(user);
            if (!resetAccessFailedCountResult.Succeeded)
                throw new ApiException(string.Join(" ", resetAccessFailedCountResult.Errors.Select(e => e.Description)));

            return $"User '{user.Email}' yeniden active edildi.";
        }

        // ── Mapping ─────────────────────────────────────────────────────────

        private static UserSummaryDto MapToSummary(ApplicationUser user, string role)
        {
            return new UserSummaryDto
            {
                Id = user.Id,
                UserName = user.UserName,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                EmailConfirmed = user.EmailConfirmed,
                Role = role,
                IsActive = !user.LockoutEnd.HasValue || user.LockoutEnd.Value <= DateTimeOffset.UtcNow,
                DeactivatedUntil = user.LockoutEnd >= DateTimeOffset.MaxValue.AddDays(-1)
                    ? null
                    : user.LockoutEnd
            };
        }

        private async Task<string> GetSingleRoleAsync(ApplicationUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Count != 1)
                throw new ApiException($"User '{user.Email}' must have exactly one role. Found: {roles.Count}.");

            return roles[0];
        }

        private static DateTimeOffset ResolveLockoutEnd(string durationKey)
        {
            var key = (durationKey ?? string.Empty).Trim().ToUpperInvariant();
            var now = DateTimeOffset.UtcNow;

            return key switch
            {
                "UNLIMITED" => DateTimeOffset.MaxValue,
                "ONE_HOUR" => now.AddHours(1),
                "ONE_DAY" => now.AddDays(1),
                "ONE_WEEK" => now.AddDays(7),
                "ONE_MONTH" => now.AddMonths(1),
                _ => throw new ApiException($"Unsupported deactivation duration '{durationKey}'.")
            };
        }
    }
}
