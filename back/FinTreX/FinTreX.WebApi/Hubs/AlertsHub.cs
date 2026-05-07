using System.Security.Claims;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FinTreX.WebApi.Hubs
{
    /// <summary>
    /// Kullanıcının kendi alarm tetiklemelerini canlı almasını sağlar.
    /// Bağlanan kullanıcı otomatik olarak kendi user-id grubuna eklenir;
    /// sunucu tarafından <c>AlertTriggered</c> eventi sadece o gruba gönderilir.
    /// </summary>
    [Authorize]
    public class AlertsHub : Hub<IAlertsClient>
    {
        internal const string GroupPrefix = "alerts:user:";
        internal const string AdminGroupName = "alerts:role:admin";

        public override async Task OnConnectedAsync()
        {
            var userId = ResolveUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, BuildGroupName(userId));
            }

            if (IsAdmin())
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroupName);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(System.Exception? exception)
        {
            var userId = ResolveUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildGroupName(userId));
            }

            if (IsAdmin())
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, AdminGroupName);
            }

            await base.OnDisconnectedAsync(exception);
        }

        private string? ResolveUserId()
        {
            var user = Context.User;
            return user?.FindFirstValue("uid")
                ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        private bool IsAdmin()
        {
            var user = Context.User;
            if (user?.IsInRole("Admin") == true) return true;

            return user?.Claims.Any(claim =>
                (claim.Type == ClaimTypes.Role || claim.Type == "role" || claim.Type == "roles")
                && string.Equals(claim.Value, "Admin", System.StringComparison.OrdinalIgnoreCase)) == true;
        }

        internal static string BuildGroupName(string userId) => GroupPrefix + userId;
    }
}
