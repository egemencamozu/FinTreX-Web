using System;

namespace FinTreX.Core.Exceptions
{
    /// <summary>
    /// Exception thrown when a user attempts to perform an action they aren't authorized for
    /// (e.g. an economist trying to modify a client's portfolio).
    /// </summary>
    public class ForbiddenException : Exception
    {
        public ForbiddenException() : base("You do not have permission to perform this action.")
        {
        }

        public ForbiddenException(string message) : base(message)
        {
        }
    }
}
