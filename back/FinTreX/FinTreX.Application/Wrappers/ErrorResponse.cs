using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FinTreX.Core.Wrappers
{
    public class ErrorResponse
    {
        public string Message { get; set; }
        public List<string> Errors { get; set; }

        [JsonPropertyName("code")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string Code { get; set; }

        [JsonPropertyName("email")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string Email { get; set; }
    }
}
