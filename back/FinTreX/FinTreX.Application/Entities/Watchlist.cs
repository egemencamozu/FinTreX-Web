using System;
using System.Collections.Generic;

namespace FinTreX.Core.Entities
{
    /// <summary>
    /// Kullanıcının oluşturduğu izleme listesi (watchlist).
    /// Bir kullanıcı birden çok listeye sahip olabilir; yeni kayıt olanlar için
    /// otomatik bir "Ana Liste" (<see cref="IsDefault"/>) oluşturulur.
    /// </summary>
    public class Watchlist
    {
        public int Id { get; set; }

        /// <summary>Listeyi sahip olan kullanıcı.</summary>
        public string ApplicationUserId { get; set; } = string.Empty;

        /// <summary>Kullanıcıya gösterilen liste adı (örn. "Ana Liste", "Uzun Vadeli").</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>UI'da sembol rozeti olarak kullanılacak opsiyonel renk (hex).</summary>
        public string? Color { get; set; }

        /// <summary>Kullanıcının elle sürükle-bırak sıralamasını desteklemek için.</summary>
        public int SortOrder { get; set; }

        /// <summary>Otomatik oluşturulmuş "Ana Liste" kaydı mı?</summary>
        public bool IsDefault { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAtUtc { get; set; }

        // ── Navigation ──────────────────────────────────────────────────────
        public ICollection<WatchlistItem> Items { get; set; } = new List<WatchlistItem>();
    }
}
