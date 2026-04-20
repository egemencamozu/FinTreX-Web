using FinTreX.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;

namespace FinTreX.WebApi.Services
{
    /// <summary>
    /// WebApi implementation of ICurrentUserService using HttpContextAccessor.
    /// </summary>
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public string UserId => _httpContextAccessor.HttpContext?.User?.FindFirstValue("uid") ?? string.Empty;

        public string Email => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

        public IReadOnlyList<string> Roles => _httpContextAccessor.HttpContext?.User?.FindAll(ClaimTypes.Role)
            .Select(c => c.Value).ToList().AsReadOnly();

        public bool IsInRole(string role) => Roles.Contains(role);

        public bool IsEconomist => IsInRole("Economist");

        public bool IsAdmin => IsInRole("Admin");
        public string? AuthToken =>
            _httpContextAccessor.HttpContext?.Request.Headers["Authorization"]
                .ToString().Replace("Bearer ", "", System.StringComparison.OrdinalIgnoreCase);
    }
}
