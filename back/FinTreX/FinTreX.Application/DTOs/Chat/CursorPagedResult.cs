using System.Collections.Generic;

namespace FinTreX.Core.DTOs.Chat
{
    /// <summary>
    /// Generic cursor-based pagination result for chat messages.
    /// </summary>
    public class CursorPagedResult<T>
    {
        public List<T> Items { get; set; } = new();

        /// <summary>The cursor to use for the next page (null = no more pages).</summary>
        public long? NextCursor { get; set; }

        public bool HasMore { get; set; }
    }
}
