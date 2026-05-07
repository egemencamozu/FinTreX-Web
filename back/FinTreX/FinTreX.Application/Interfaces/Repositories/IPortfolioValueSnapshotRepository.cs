using FinTreX.Core.Entities;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IPortfolioValueSnapshotRepository
    {
        Task AddBatchAsync(IReadOnlyCollection<PortfolioValueSnapshot> snapshots, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<PortfolioValueSnapshot>> GetRangeAsync(int portfolioId, DateTime startUtc, DateTime endUtc, CancellationToken cancellationToken = default);
        Task<DateTime?> GetFirstSnapshotAtUtcAsync(int portfolioId, CancellationToken cancellationToken = default);
    }
}