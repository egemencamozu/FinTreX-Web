using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class LocalFileStorageService : IFileStorageService
    {
        private static readonly string[] AllowedContentTypes = { "application/pdf", "image/png", "image/jpeg" };
        private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

        private readonly string _rootPath;

        public LocalFileStorageService(IConfiguration configuration)
        {
            _rootPath = configuration["FileStorage:RootPath"]
                ?? Path.Combine(AppContext.BaseDirectory, "storage");
        }

        public async Task<StoredFile> SaveAsync(Stream content, string fileName, string contentType, string folder)
        {
            if (!Array.Exists(AllowedContentTypes, ct => ct.Equals(contentType, StringComparison.OrdinalIgnoreCase)))
                throw new ApiException($"File type '{contentType}' is not allowed. Allowed: PDF, PNG, JPEG.");

            var ext = Path.GetExtension(fileName);
            var storageKey = Path.Combine(folder, $"{Guid.NewGuid()}{ext}");
            var fullPath = Path.Combine(_rootPath, storageKey);

            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write);
            await content.CopyToAsync(fileStream);

            if (fileStream.Length > MaxFileSizeBytes)
            {
                fileStream.Close();
                File.Delete(fullPath);
                throw new ApiException($"File size exceeds the 10 MB limit.");
            }

            return new StoredFile(storageKey, fileName, contentType, fileStream.Length);
        }

        public Task<(Stream Stream, string ContentType, string FileName)> OpenReadAsync(string storageKey)
        {
            var fullPath = Path.Combine(_rootPath, storageKey);
            if (!File.Exists(fullPath))
                throw new ApiException("File not found.");

            var ext = Path.GetExtension(storageKey).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => "application/octet-stream"
            };

            Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
            return Task.FromResult((stream, contentType, Path.GetFileName(storageKey)));
        }

        public Task DeleteAsync(string storageKey)
        {
            var fullPath = Path.Combine(_rootPath, storageKey);
            if (File.Exists(fullPath))
                File.Delete(fullPath);
            return Task.CompletedTask;
        }
    }
}
