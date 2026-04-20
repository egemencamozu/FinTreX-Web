using System;

namespace FinTreX.Core.Exceptions
{
    /// <summary>
    /// Exception thrown when a request cannot be processed due to a conflict
    /// (e.g. concurrency lock already held).
    /// </summary>
    public class ConflictException : Exception
    {
        public ConflictException(string message) : base(message) { }
    }
}
