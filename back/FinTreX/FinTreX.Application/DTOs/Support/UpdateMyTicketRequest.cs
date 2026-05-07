using System.ComponentModel.DataAnnotations;

namespace FinTreX.Core.DTOs.Support
{
    public class UpdateMyTicketRequest
    {
        [Required]
        [MaxLength(4000)]
        public string Message { get; set; }
    }
}
