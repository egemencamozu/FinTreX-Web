using System.ComponentModel.DataAnnotations;
using FinTreX.Core.Enums;

namespace FinTreX.Core.DTOs.Support
{
    public class CreateSupportTicketRequest
    {
        [Required]
        public SupportTicketType Type { get; set; }

        [Required]
        [MaxLength(200)]
        public string Subject { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Message { get; set; }
    }
}
