namespace FinTreX.Core.DTOs.Account
{
    public class RegisterResponse
    {
        public bool Success { get; set; }
        public bool RequiresVerification { get; set; }
        public string Email { get; set; }
        public string Message { get; set; }
    }
}
