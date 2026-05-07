using FinTreX.Core.Entities;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public sealed class PortfolioValueSnapshotRepository : IPortfolioValueSnapshotRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public PortfolioValueSnapshotRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddBatchAsync(IReadOnlyCollection<PortfolioValueSnapshot> snapshots, CancellationToken cancellationToken = default)
        {
            if (snapshots is null || snapshots.Count == 0)
            {
                return;
            }

            await _dbContext.PortfolioValueSnapshots.AddRangeAsync(snapshots, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<PortfolioValueSnapshot>> GetRangeAsync(
            int portfolioId,
            DateTime startUtc,
            DateTime endUtc,
            CancellationToken cancellationToken = default)
        {
            return await _dbContext.PortfolioValueSnapshots
                .AsNoTracking()
                .Where(x => x.PortfolioId == portfolioId && x.CapturedAtUtc >= startUtc && x.CapturedAtUtc <= endUtc)
                .OrderBy(x => x.CapturedAtUtc)
                .ToListAsync(cancellationToken);
        }

        public async Task<DateTime?> GetFirstSnapshotAtUtcAsync(int portfolioId, CancellationToken cancellationToken = default)
        {
            return await _dbContext.PortfolioValueSnapshots
                .AsNoTracking()
                .Where(x => x.PortfolioId == portfolioId)
                .OrderBy(x => x.CapturedAtUtc)
                .Select(x => (DateTime?)x.CapturedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }
    }
}