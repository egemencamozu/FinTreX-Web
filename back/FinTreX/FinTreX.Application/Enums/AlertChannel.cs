using System;

namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Alarmın hangi kanallar üzerinden bildirim göndereceğini belirler.
    /// Flags enum — tek alanda birden fazla kanal saklanır.
    /// </summary>
    [Flags]
    public enum AlertChannel
    {
        None = 0,
        IN_APP = 1 << 0,
        EMAIL = 1 << 1,
    }
}
