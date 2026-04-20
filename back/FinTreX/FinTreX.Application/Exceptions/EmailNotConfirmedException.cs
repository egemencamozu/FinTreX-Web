namespace FinTreX.Core.Exceptions
{
    public class EmailNotConfirmedException : ApiException
    {
        public string Email { get; }

        public EmailNotConfirmedException(string email, string message) : base(message)
        {
            Email = email;
        }
    }
}
