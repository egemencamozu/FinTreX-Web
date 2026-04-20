using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;

namespace FinTreX.WebApi.Controllers
//deneme
{
    /// <summary>
    /// Base controller providing common utilities for authenticated API controllers.
    /// All controllers that require authentication should inherit from this class.
    /// </summary>
    [Route("api/v1/[controller]")]
    [ApiController]
    public abstract class BaseApiController : ControllerBase
    {
        /// <summary>
        /// Returns the authenticated user's Identity ID (from JWT "uid" claim).
        /// </summary>
        protected string AuthenticatedUserId =>
            HttpContext.User.FindFirstValue("uid") ?? string.Empty;

        /// <summary>
        /// Returns the authenticated user's email address.
        /// </summary>
        protected string AuthenticatedUserEmail =>
            HttpContext.User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

        /// <summary>
        /// Returns the list of role names assigned to the authenticated user.
        /// </summary>
        protected IReadOnlyList<string> AuthenticatedUserRoles =>
            HttpContext.User.FindAll("roles").Select(c => c.Value).ToList().AsReadOnly();

        /// <summary>
        /// Extracts the real client IP from the X-Forwarded-For header or the connection.
        /// </summary>
        protected string ClientIpAddress
        {
            get
            {
                if (Request.Headers.ContainsKey("X-Forwarded-For"))
                    return Request.Headers["X-Forwarded-For"].ToString();

                return HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            }
        }
    }
}
