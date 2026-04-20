using System.Collections.Generic;

namespace FinTreX.WebApi.Hubs
{
    public interface IMarketDataSubscriptionTracker
    {
        int TrackSubscribe(string connectionId, string cacheKey);
        int TrackUnsubscribe(string connectionId, string cacheKey);
        IReadOnlyList<string> RemoveConnection(string connectionId);
    }
}
