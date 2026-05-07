using System.IO;

namespace FinTreX.Core.DTOs.Economist
{
    public class FileUploadInfo
    {
        public Stream Stream { get; set; }
        public string FileName { get; set; }
        public string ContentType { get; set; }
        public long Length { get; set; }
    }
}
