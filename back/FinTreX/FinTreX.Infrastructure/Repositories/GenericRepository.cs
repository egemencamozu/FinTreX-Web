using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Repositories
{
    /// <summary>
    /// Implementation of generic repository using Entity Framework Core.
    /// </summary>
    public class GenericRepository<T> : IGenericRepository<T> where T : class
    {
        protected readonly ApplicationDbContext _dbContext;

        public GenericRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public virtual async Task<T> GetByIdAsync(int id)
        {
            return await _dbContext.Set<T>().FindAsync(id);
        }

        public virtual async Task<IReadOnlyList<T>> GetAllAsync()
        {
            return await _dbContext.Set<T>().AsNoTracking().ToListAsync();
        }

        public virtual async Task<T> AddAsync(T entity)
        {
            await _dbContext.Set<T>().AddAsync(entity);
            await _dbContext.SaveChangesAsync();
            return entity;
        }

        public virtual async Task UpdateAsync(T entity)
        {
            var entry = _dbContext.Entry(entity);

            if (entry.State == EntityState.Detached)
            {
                // Check if another instance with the same PK is already tracked
                var tracked = _dbContext.Set<T>().Local.FirstOrDefault(e =>
                {
                    var eEntry = _dbContext.Entry(e);
                    return entry.Metadata.FindPrimaryKey()!.Properties
                        .All(p => Equals(
                            eEntry.Property(p.Name).CurrentValue,
                            entry.Property(p.Name).CurrentValue));
                });

                if (tracked != null)
                {
                    // Copy values into the already-tracked instance
                    _dbContext.Entry(tracked).CurrentValues.SetValues(entity);
                }
                else
                {
                    _dbContext.Set<T>().Attach(entity);
                    _dbContext.Entry(entity).State = EntityState.Modified;
                }
            }
            else
            {
                entry.State = EntityState.Modified;
            }

            var affected = await _dbContext.SaveChangesAsync();
            if (affected == 0)
            {
                throw new InvalidOperationException(
                    $"Update failed: 0 rows affected for {typeof(T).Name}.");
            }
        }

        public virtual async Task DeleteAsync(T entity)
        {
            var entry = _dbContext.Entry(entity);
            if (entry.State == EntityState.Detached)
                _dbContext.Set<T>().Attach(entity);
            _dbContext.Set<T>().Remove(entity);
            await _dbContext.SaveChangesAsync();
        }
    }
}
