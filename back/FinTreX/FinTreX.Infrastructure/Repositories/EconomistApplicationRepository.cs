using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    public class EconomistApplicationRepository : IEconomistApplicationRepository
    {
        private readonly ApplicationDbContext _dbContext;

        public EconomistApplicationRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<EconomistApplication?> GetByIdAsync(int id)
        {
            return await _dbContext.EconomistApplications
                .Include(a => a.Links)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<EconomistApplication?> GetLatestByUserIdAsync(string userId)
        {
            return await _dbContext.EconomistApplications
                .Include(a => a.Links)
                .Where(a => a.ApplicantUserId == userId)
                .OrderByDescending(a => a.SubmittedAtUtc)
                .FirstOrDefaultAsync();
        }

        public async Task<IReadOnlyList<EconomistApplication>> GetAllByUserIdAsync(string userId)
        {
            return await _dbContext.EconomistApplications
                .Include(a => a.Links)
                .Where(a => a.ApplicantUserId == userId)
                .OrderByDescending(a => a.SubmittedAtUtc)
                .ToListAsync();
        }

        public async Task<(IReadOnlyList<EconomistApplication> Items, int TotalCount)> GetPagedByStatusAsync(
            EconomistStatus? status, int skip, int take)
        {
            var query = _dbContext.EconomistApplications
                .Include(a => a.Links)
                .AsQueryable();

            if (status.HasValue)
                query = query.Where(a => a.Status == status.Value);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.SubmittedAtUtc)
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            return (items, total);
        }

        public async Task AddAsync(EconomistApplication application)
        {
            await _dbContext.EconomistApplications.AddAsync(application);
            await _dbContext.SaveChangesAsync();
        }

        public async Task UpdateAsync(EconomistApplication application)
        {
            _dbContext.EconomistApplications.Update(application);
            await _dbContext.SaveChangesAsync();
        }
    }
}
