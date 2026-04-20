using FinTreX.Core.Entities;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface ICryptoEnrichmentRepository
    {
        Task<IReadOnlyList<CryptoEnrichmentSnapshot>> GetAllAsync(CancellationToken cancellationToken = default);
        Task<DateTime?> GetLastRefreshedAtUtcAsync(CancellationToken cancellationToken = default);
        Task UpsertBatchAsync(IReadOnlyList<CryptoEnrichmentSnapshot> snapshots, CancellationToken cancellationToken = default);
    }
}
