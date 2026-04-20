using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace FinTreX.WebApi.Hubs
{
    /// <summary>
    /// Thread-safe in-memory tracker for user connections. Supports multi-tab (multiple connections per user).
    /// </summary>
    public class ChatConnectionTracker : IChatConnectionTracker
    {
        private readonly ConcurrentDictionary<string, HashSet<string>> _connections = new();

        public void TrackConnection(string userId, string connectionId)
        {
            _connections.AddOrUpdate(
                userId,
                _ => new HashSet<string> { connectionId },
                (_, set) => { lock (set) { set.Add(connectionId); } return set; });
        }

        public void RemoveConnection(string userId, string connectionId)
        {
            if (!_connections.TryGetValue(userId, out var set)) return;

            lock (set)
            {
                set.Remove(connectionId);
                if (set.Count == 0)
                    _connections.TryRemove(userId, out _);
            }
        }

        public bool IsOnline(string userId)
        {
            return _connections.ContainsKey(userId);
        }

        public IReadOnlyList<string> GetConnectionIds(string userId)
        {
            if (_connections.TryGetValue(userId, out var set))
            {
                lock (set) { return set.ToList(); }
            }
            return new List<string>();
        }

        public IReadOnlyList<string> GetAllOnlineUserIds()
        {
            return _connections.Keys.ToList();
        }
    }
}
