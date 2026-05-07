namespace FinTreX.Core.DTOs.Tasks
{
    public class TaskCreatedEventDto
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; }
        public string ClientName { get; set; }
    }
}
