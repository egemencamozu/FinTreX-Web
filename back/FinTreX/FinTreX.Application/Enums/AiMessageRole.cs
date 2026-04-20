namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Role of a message participant in an AI assistant conversation.
    /// Mirrors OpenAI / LangGraph convention (user, assistant).
    /// </summary>
    public enum AiMessageRole
    {
        User = 0,
        Assistant = 1
    }
}
