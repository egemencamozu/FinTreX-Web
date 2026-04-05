namespace FinTreX.Core.Settings
{
    public class EmailSettings
    {
        public bool Enabled { get; set; }
        public string FromEmail { get; set; }
        public string FromName { get; set; }
        public string SmtpHost { get; set; }
        public int SmtpPort { get; set; }
        public bool UseSsl { get; set; }
        public string SmtpUserName { get; set; }
        public string SmtpPassword { get; set; }
    }
}
