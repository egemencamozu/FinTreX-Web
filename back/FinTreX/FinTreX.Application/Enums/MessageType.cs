namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Defines the type of a chat message. Extensible for future media types.
    /// </summary>
    public enum MessageType
    {
        Text = 0,
        System = 1
        // Future: Image = 2, File = 3, TaskReference = 4
    }
}
