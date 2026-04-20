namespace FinTreX.Core.DTOs.Chat
{
    public class CreateConversationRequest
    {
        /// <summary>The economist to start a conversation with.</summary>
        public string EconomistId { get; set; }

        /// <summary>Optional topic title. Null/empty → "Adsız Sohbet".</summary>
        public string Title { get; set; }

        /// <summary>Optional first message. If provided, sent immediately.</summary>
        public string InitialMessage { get; set; }
    }
}
