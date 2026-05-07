namespace FinTreX.Core.DTOs.Tasks
{
    public class TaskStatusChangedEventDto
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; }
        public string Status { get; set; }
        public string UpdatedByName { get; set; }
    }
}
