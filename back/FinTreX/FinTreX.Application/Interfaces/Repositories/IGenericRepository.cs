using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Repositories
{
    /// <summary>
    /// Base interface for generic repository operations.
    /// Provides common CRUD functionality for all entities.
    /// </summary>
    /// <typeparam name="T">The entity type.</typeparam>
    public interface IGenericRepository<T> where T : class
    {
        Task<T> GetByIdAsync(int id);
        Task<IReadOnlyList<T>> GetAllAsync();
        Task<T> AddAsync(T entity);
        Task UpdateAsync(T entity);
        Task DeleteAsync(T entity);
    }
}
