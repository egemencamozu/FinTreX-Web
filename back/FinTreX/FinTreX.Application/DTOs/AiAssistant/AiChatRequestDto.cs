using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.AiAssistant
{
    /// <summary>Request DTO sent by the Angular frontend.</summary>
    public class AiChatRequestDto
    {
        /// <summary>Null for a brand-new conversation; set for continuing one.</summary>
        public int? ConversationId { get; set; }

        [Required]
        [MaxLength(4000, ErrorMessage = "Mesaj 4000 karakteri geçemez.")]
        [MinLength(1, ErrorMessage = "Mesaj boş olamaz.")]
        public string Message { get; set; }

        /// <summary>For ECONOMIST role: the client (user) whose portfolio is being analyzed.</summary>
        public string? ClientId { get; set; }
    }
}
