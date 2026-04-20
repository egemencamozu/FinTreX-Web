using System.Collections.Generic;

namespace FinTreX.WebApi.Hubs
{
    public interface IChatConnectionTracker
    {
        void TrackConnection(string userId, string connectionId);
        void RemoveConnection(string userId, string connectionId);
        bool IsOnline(string userId);
        IReadOnlyList<string> GetConnectionIds(string userId);
        IReadOnlyList<string> GetAllOnlineUserIds();
    }
}
