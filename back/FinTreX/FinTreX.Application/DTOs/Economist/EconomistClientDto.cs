using System;

namespace FinTreX.Core.DTOs.Economist
{
    public class EconomistClientDto
    {
        public int Id { get; set; }
        public string EconomistId { get; set; }
        public string ClientId { get; set; }
        public string EconomistName { get; set; }
        public string ClientName { get; set; }
        public DateTime AssignedAtUtc { get; set; }
        public bool IsActive { get; set; }
        public string Notes { get; set; }
    }
}
