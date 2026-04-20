namespace FinTreX.Core.Settings
{
    public class AiAssistantSettings
    {
        public string ServiceUrl { get; set; } = "http://localhost:8500";
        public string ChatEndpoint { get; set; } = "/ai-chat";
        public string StreamEndpoint { get; set; } = "/ai-chat/stream";
        public int TimeoutSeconds { get; set; } = 60;
        public int MaxConversationHistoryMessages { get; set; } = 20;
        public int MaxConversationsPerUser { get; set; } = 50;
        /// <summary>Orphan-lock cleanup threshold. If ProcessingStartedAt > this, force reset.</summary>
        public int ProcessingLockTimeoutSeconds { get; set; } = 120;
    }
}
