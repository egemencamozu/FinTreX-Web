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
    public sealed class DailyCloseRepository : IDailyCloseRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public DailyCloseRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<DailyClose>> GetByTickerAsync(string ticker)
        {
            return await _dbContext.DailyCloses
                .AsNoTracking()
                .Where(x => x.Ticker == ticker)
                .OrderByDescending(x => x.Date)
                .ToListAsync();
        }

        public async Task<IReadOnlyList<DailyClose>> GetLatestByTickersAsync(
            IReadOnlyCollection<string> tickers,
            string assetType,
            CancellationToken cancellationToken = default)
        {
            if (tickers is null || tickers.Count == 0)
            {
                return Array.Empty<DailyClose>();
            }

            // Single query: for each ticker get the row with the latest date.
            return await _dbContext.DailyCloses
                .AsNoTracking()
                .Where(x => tickers.Contains(x.Ticker) && x.AssetType == assetType)
                .GroupBy(x => x.Ticker)
                .Select(g => g.OrderByDescending(x => x.Date).First())
                .ToListAsync(cancellationToken);
        }

        public async Task UpsertAsync(DailyClose record, CancellationToken cancellationToken = default)
        {
            var existing = await _dbContext.DailyCloses
                .AsTracking()
                .FirstOrDefaultAsync(x => x.Ticker == record.Ticker && x.Date == record.Date, cancellationToken);

            if (existing is null)
            {
                _dbContext.DailyCloses.Add(record);
            }
            else
            {
                existing.ClosePrice = record.ClosePrice;
                existing.Change = record.Change;
                existing.ChangePercent = record.ChangePercent;
                existing.Volume = record.Volume;
                existing.WrittenAt = DateTime.UtcNow;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task UpsertBatchAsync(IReadOnlyCollection<DailyClose> records, CancellationToken cancellationToken = default)
        {
            if (records is null || records.Count == 0)
            {
                return;
            }

            var writtenAt = DateTime.UtcNow;

            // Group by date to issue one bulk-read per date instead of N individual lookups.
            var dateGroups = records.GroupBy(r => r.Date);

            foreach (var group in dateGroups)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var tickers = group.Select(r => r.Ticker).ToList();
                var date = group.Key;

                // Single query: load all existing rows for this date in one round-trip.
                var existingByTicker = await _dbContext.DailyCloses
                    .AsTracking()
                    .Where(x => x.Date == date && tickers.Contains(x.Ticker))
                    .ToDictionaryAsync(x => x.Ticker, StringComparer.OrdinalIgnoreCase, cancellationToken);

                foreach (var record in group)
                {
                    if (existingByTicker.TryGetValue(record.Ticker, out var existing))
                    {
                        existing.ClosePrice = record.ClosePrice;
                        existing.Change = record.Change;
                        existing.ChangePercent = record.ChangePercent;
                        existing.Volume = record.Volume;
                        existing.WrittenAt = writtenAt;
                    }
                    else
                    {
                        record.WrittenAt = writtenAt;
                        _dbContext.DailyCloses.Add(record);
                    }
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
