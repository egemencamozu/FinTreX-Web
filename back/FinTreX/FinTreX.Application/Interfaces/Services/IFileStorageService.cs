using System.IO;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public record StoredFile(string StorageKey, string FileName, string ContentType, long SizeBytes);

    public interface IFileStorageService
    {
        Task<StoredFile> SaveAsync(Stream content, string fileName, string contentType, string folder);
        Task<(Stream Stream, string ContentType, string FileName)> OpenReadAsync(string storageKey);
        Task DeleteAsync(string storageKey);
    }
}
