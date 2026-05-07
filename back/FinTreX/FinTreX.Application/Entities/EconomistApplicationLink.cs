namespace FinTreX.Core.Entities
{
    public class EconomistApplicationLink
    {
        public int Id { get; set; }
        public int EconomistApplicationId { get; set; }
        public EconomistApplication EconomistApplication { get; set; }

        /// <summary>LinkedIn, YouTube, Twitter, Website, etc.</summary>
        public string Platform { get; set; }
        public string Url { get; set; }
    }
}
