namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Subscription tiers controlling economist assignment limits.
    /// Default: 1 economist (no change), Premium: 3 (changeable), Ultra: unlimited.
    /// </summary>
    public enum SubscriptionTier
    {
        Default,
        Premium,
        Ultra
    }
}
