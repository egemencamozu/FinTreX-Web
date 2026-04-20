namespace FinTreX.Core.Interfaces
{
    /// <summary>
    /// Allows runtime subscription of new BIST ticker symbols to the active Yahoo stream.
    /// Call this whenever a user adds a new BIST asset to their portfolio.
    /// </summary>
    public interface IBistSubscriptionManager
    {
        /// <summary>
        /// Enqueues a BIST ticker (e.g. "THYAO.IS") for immediate subscription
        /// on the active Yahoo WebSocket connection. No-op if already subscribed
        /// or if the connection is not currently active.
        /// </summary>
        void RequestSubscription(string ticker);
    }
}
