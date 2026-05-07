namespace FinTreX.Core.Enums
{
    /// <summary>Price alarm kaydının yaşam döngüsü durumu.</summary>
    public enum AlertStatus
    {
        /// <summary>Aktif — koşul izleniyor.</summary>
        ACTIVE = 0,

        /// <summary>Tetiklendi — ONCE modunda beklemede kalır.</summary>
        TRIGGERED = 1,

        /// <summary>Kullanıcı tarafından duraklatılmış.</summary>
        PAUSED = 2,

        /// <summary>Geçerlilik süresi doldu (opsiyonel TTL için).</summary>
        EXPIRED = 3,
    }
}
