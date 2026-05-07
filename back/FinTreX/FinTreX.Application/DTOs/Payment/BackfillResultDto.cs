namespace FinTreX.Core.DTOs.Payment
{
    /// <summary>
    /// Summary returned by the admin backfill endpoint that imports historical
    /// invoices from Stripe into the PaymentTransactions table.
    /// </summary>
    public class BackfillResultDto
    {
        public int UsersProcessed { get; set; }
        public int InvoicesScanned { get; set; }
        public int RecordsInserted { get; set; }
        public int RecordsUpdated { get; set; }
        public int RecordsSkipped { get; set; }
    }
}
