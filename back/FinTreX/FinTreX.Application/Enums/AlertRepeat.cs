namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Tetikleme sonrası alarma ne olacağını belirler.
    /// </summary>
    public enum AlertRepeat
    {
        /// <summary>Tetiklenince pasife düşer, tekrar ateşlemez.</summary>
        ONCE = 0,

        /// <summary>Koşul yeniden oluşursa tekrar uyarı gönderir.</summary>
        RECURRING = 1,

        /// <summary>Tetiklenince alarm kaydı silinir.</summary>
        AUTO_DELETE = 2,
    }
}
