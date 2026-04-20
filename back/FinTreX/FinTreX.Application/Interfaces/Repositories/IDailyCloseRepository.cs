using FinTreX.Core.Entities;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IDailyCloseRepository
    {
        Task<IReadOnlyList<DailyClose>> GetByTickerAsync(string ticker);
        Task<IReadOnlyList<DailyClose>> GetLatestByTickersAsync(IReadOnlyCollection<string> tickers, string assetType, CancellationToken cancellationToken = default);
        Task UpsertAsync(DailyClose record, CancellationToken cancellationToken = default);
        Task UpsertBatchAsync(IReadOnlyCollection<DailyClose> records, CancellationToken cancellationToken = default);
    }
}
