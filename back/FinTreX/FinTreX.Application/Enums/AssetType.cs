namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Supported financial asset categories.
    /// Stored as string in DB via HasConversion for readability.
    /// </summary>
    public enum AssetType
    {
        BIST,           // Borsa İstanbul equities
        Crypto,         // Cryptocurrencies
        PreciousMetal   // Gold, Silver, Platinum etc.
    }
}
