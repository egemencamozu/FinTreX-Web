using System.Collections.Generic;

namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Abstraction for accessing current user identity (ID and Roles) in the application layer.
    /// Implementation is in WebApi using IHttpContextAccessor.
    /// </summary>
    public interface ICurrentUserService
    {
        string UserId { get; }
        string Email { get; }
        IReadOnlyList<string> Roles { get; }
        bool IsInRole(string role);
        bool IsEconomist { get; }
        bool IsAdmin { get; }
    }
}
