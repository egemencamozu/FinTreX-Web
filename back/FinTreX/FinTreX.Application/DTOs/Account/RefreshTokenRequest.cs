namespace FinTreX.Core.DTOs.Account
{
    /// <summary>Request to exchange a refresh token for a new JWT + refresh token pair.</summary>
    public class RefreshTokenRequest
    {
        public string Token { get; set; }
    }
}
