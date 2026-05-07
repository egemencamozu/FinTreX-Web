namespace FinTreX.Core.Enums
{
    /// <summary>
    /// Lifecycle status of a payment transaction, mirrored from Stripe Invoice/Charge states.
    /// </summary>
    public enum PaymentStatus
    {
        /// <summary>Invoice finalized but not yet paid (draft → open in Stripe).</summary>
        Open,

        /// <summary>Payment succeeded.</summary>
        Paid,

        /// <summary>Payment attempt failed (card declined, insufficient funds, etc.).</summary>
        Failed,

        /// <summary>Stripe gave up collecting (uncollectible).</summary>
        Uncollectible,

        /// <summary>Refunded in full.</summary>
        Refunded,

        /// <summary>Refunded partially — original amount still relevant.</summary>
        PartiallyRefunded,

        /// <summary>Invoice was voided before collection.</summary>
        Void
    }
}
