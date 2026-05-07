namespace FinTreX.Core.DTOs.Economist
{
    public class EconomistApplicationLinkDto
    {
        public int Id { get; set; }
        public string Platform { get; set; }
        public string Url { get; set; }
    }

    public class EconomistApplicationLinkRequest
    {
        public string Platform { get; set; }
        public string Url { get; set; }
    }
}
