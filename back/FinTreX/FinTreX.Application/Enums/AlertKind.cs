namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Whether the price alert tracks an absolute price or a percentage move
    /// relative to a baseline captured at creation time.
    /// </summary>
    public enum AlertKind
    {
        PRICE = 0,
        PERCENT = 1,
    }
}
