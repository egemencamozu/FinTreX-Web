using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    public interface IEconomistApplicationRepository
    {
        Task<EconomistApplication?> GetByIdAsync(int id);
        Task<EconomistApplication?> GetLatestByUserIdAsync(string userId);
        Task<IReadOnlyList<EconomistApplication>> GetAllByUserIdAsync(string userId);
        Task<(IReadOnlyList<EconomistApplication> Items, int TotalCount)> GetPagedByStatusAsync(EconomistStatus? status, int skip, int take);
        Task AddAsync(EconomistApplication application);
        Task UpdateAsync(EconomistApplication application);    }
}
