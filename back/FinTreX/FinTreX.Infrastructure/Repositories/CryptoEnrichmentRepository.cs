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
    public sealed class CryptoEnrichmentRepository : ICryptoEnrichmentRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public CryptoEnrichmentRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<CryptoEnrichmentSnapshot>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _dbContext.CryptoEnrichmentSnapshots
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task<DateTime?> GetLastRefreshedAtUtcAsync(CancellationToken cancellationToken = default)
        {
            var any = await _dbContext.CryptoEnrichmentSnapshots
                .AsNoTracking()
                .AnyAsync(cancellationToken);

            if (!any) return null;

            return await _dbContext.CryptoEnrichmentSnapshots
                .AsNoTracking()
                .MaxAsync(x => (DateTime?)x.RefreshedAtUtc, cancellationToken);
        }

        public async Task UpsertBatchAsync(IReadOnlyList<CryptoEnrichmentSnapshot> snapshots, CancellationToken cancellationToken = default)
        {
            if (snapshots is null || snapshots.Count == 0)
                return;

            var symbols = snapshots.Select(s => s.Symbol).ToList();

            var existingBySymbol = await _dbContext.CryptoEnrichmentSnapshots
                .AsTracking()
                .Where(x => symbols.Contains(x.Symbol))
                .ToDictionaryAsync(x => x.Symbol, StringComparer.OrdinalIgnoreCase, cancellationToken);

            foreach (var snapshot in snapshots)
            {
                if (existingBySymbol.TryGetValue(snapshot.Symbol, out var existing))
                {
                    existing.MarketCapUsdt = snapshot.MarketCapUsdt;
                    existing.CirculatingSupply = snapshot.CirculatingSupply;
                    existing.TotalSupply = snapshot.TotalSupply;
                    existing.Network = snapshot.Network;
                    existing.EnrichmentStatus = snapshot.EnrichmentStatus;
                    existing.LastAttemptedAtUtc = snapshot.LastAttemptedAtUtc;
                    existing.LastProvider = snapshot.LastProvider;
                    existing.RefreshedAtUtc = snapshot.RefreshedAtUtc;
                }
                else
                {
                    _dbContext.CryptoEnrichmentSnapshots.Add(snapshot);
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
