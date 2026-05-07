using FinTreX.Core.DTOs.Tasks;
using FinTreX.Core.Entities;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Core.Services
{
    public class ConsultancyTaskService : IConsultancyTaskService
    {
        private readonly IConsultancyTaskRepository _taskRepository;
        private readonly IEconomistClientRepository _assignmentRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly IPreAnalysisService _preAnalysisService;
        private readonly IPreAnalysisReportRepository _reportRepository;
        private readonly IAlertsBroadcaster _broadcaster;
        private readonly ILogger<ConsultancyTaskService> _logger;

        public ConsultancyTaskService(
            IConsultancyTaskRepository taskRepository,
            IEconomistClientRepository assignmentRepository,
            ICurrentUserService currentUserService,
            IPreAnalysisService preAnalysisService,
            IPreAnalysisReportRepository reportRepository,
            IAlertsBroadcaster broadcaster,
            ILogger<ConsultancyTaskService> logger)
        {
            _taskRepository = taskRepository;
            _assignmentRepository = assignmentRepository;
            _currentUserService = currentUserService;
            _preAnalysisService = preAnalysisService;
            _reportRepository = reportRepository;
            _broadcaster = broadcaster;
            _logger = logger;
        }

        public async Task<IReadOnlyList<ConsultancyTaskDto>> GetMyTasksAsync()
        {
            if (_currentUserService.IsEconomist)
            {
                var tasks = await _taskRepository.GetByEconomistIdAsync(_currentUserService.UserId);
                return tasks.Select(MapToDto).ToList().AsReadOnly();
            }
            else
            {
                var tasks = await _taskRepository.GetByUserIdAsync(_currentUserService.UserId);
                return tasks.Select(MapToDto).ToList().AsReadOnly();
            }
        }

        public async Task<ConsultancyTaskDto> GetTaskByIdAsync(int taskId)
        {
            var task = await _taskRepository.GetWithPreAnalysisAsync(taskId);
            if (task == null) throw new KeyNotFoundException("Task not found.");

            // Accessibility check: must be the creator (user) or the assignee (economist)
            if (task.UserId != _currentUserService.UserId && task.EconomistId != _currentUserService.UserId && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Not authorized to view this task.");

            return MapToDto(task);
        }

        public async Task<ConsultancyTaskDto> CreateTaskAsync(CreateConsultancyTaskRequest request)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot create tasks.");

            // Business Rule: Standard user must be assigned to this economist
            bool isAssigned = await _assignmentRepository.IsClientAssignedAsync(request.EconomistId, _currentUserService.UserId);
            if (!isAssigned) throw new ForbiddenException("You must assign this economist to your account before creating a task.");

            var task = new ConsultancyTask
            {
                UserId = _currentUserService.UserId,
                EconomistId = request.EconomistId,
                Title = request.Title,
                Description = request.Description,
                Category = request.Category,
                Priority = request.Priority,
                Deadline = request.Deadline.HasValue 
                    ? DateTime.SpecifyKind(request.Deadline.Value, DateTimeKind.Utc) 
                    : null,
                Status = ConsultancyTaskStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _taskRepository.AddAsync(task);

            // PAA: Task oluşturulduktan sonra portföy ön-analizi üret
            try
            {
                var report = await _preAnalysisService.GenerateReportAsync(task.Id, task.UserId);
                await _reportRepository.AddAsync(report);
                // Navigation property'yi set et ki response'da rapor da dönsün
                task.PreAnalysisReport = report;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "PAA report generation failed for task {TaskId}. Task created without report.",
                    task.Id);
            }

            try
            {
                await _broadcaster.PushTaskCreatedAsync(task.EconomistId, new TaskCreatedEventDto
                {
                    TaskId = task.Id,
                    TaskTitle = task.Title,
                    ClientName = _currentUserService.Email ?? _currentUserService.UserId
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskCreated notification for task {TaskId}", task.Id);
            }

            return MapToDto(task);
        }

        public async Task<ConsultancyTaskDto> SubmitReportAsync(int taskId, SubmitReportRequest request)
        {
            if (!_currentUserService.IsEconomist)
                throw new ForbiddenException("Only economists can submit reports.");

            var task = await _taskRepository.GetWithPreAnalysisAsync(taskId)
                ?? throw new KeyNotFoundException("Task not found.");

            if (task.EconomistId != _currentUserService.UserId)
                throw new ForbiddenException("This task is not assigned to you.");

            if (task.Status == ConsultancyTaskStatus.Cancelled)
                throw new ApiException("Cannot submit a report for a cancelled task.");

            var report = request.Report?.Trim();
            if (string.IsNullOrWhiteSpace(report))
                throw new ApiException("Rapor boş olamaz.");

            task.EconomistReport = report;
            task.Status = ConsultancyTaskStatus.Completed;
            task.CompletedAtUtc = DateTime.UtcNow;

            await _taskRepository.UpdateAsync(task);

            // Notify the user via SignalR
            try
            {
                await _broadcaster.PushTaskCompletedAsync(task.UserId, new TaskCompletedEventDto
                {
                    TaskId = task.Id,
                    TaskTitle = task.Title,
                    EconomistName = _currentUserService.Email ?? _currentUserService.UserId
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskCompleted notification for task {TaskId}", taskId);
            }

            return MapToDto(task);
        }

        public async Task<ConsultancyTaskDto> GeneratePreAnalysisAsync(int taskId)
        {
            var task = await _taskRepository.GetWithPreAnalysisAsync(taskId)
                ?? throw new KeyNotFoundException("Task not found.");

            if (task.UserId != _currentUserService.UserId && task.EconomistId != _currentUserService.UserId && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Not authorized.");

            // Eğer zaten başarılı bir rapor varsa tekrar oluşturma
            if (task.PreAnalysisReport != null && task.PreAnalysisReport.IsSuccessful)
                return MapToDto(task);

            // Yeni raporu üret
            var newReport = await _preAnalysisService.GenerateReportAsync(task.Id, task.UserId);

            if (task.PreAnalysisReport != null)
            {
                // Mevcut raporu güncelle (EF Tracking çakışmalarını önlemek için)
                task.PreAnalysisReport.Summary = newReport.Summary;
                task.PreAnalysisReport.RiskLevel = newReport.RiskLevel;
                task.PreAnalysisReport.MarketOutlook = newReport.MarketOutlook;
                task.PreAnalysisReport.KeyFindings = newReport.KeyFindings;
                task.PreAnalysisReport.RawContent = newReport.RawContent;
                task.PreAnalysisReport.GeneratedAtUtc = DateTime.UtcNow;
                task.PreAnalysisReport.IsSuccessful = newReport.IsSuccessful;
                task.PreAnalysisReport.ErrorMessage = newReport.ErrorMessage?.Length > 450 
                    ? newReport.ErrorMessage.Substring(0, 450) 
                    : newReport.ErrorMessage;

                await _reportRepository.UpdateAsync(task.PreAnalysisReport);
            }
            else
            {
                if (newReport.ErrorMessage?.Length > 450)
                    newReport.ErrorMessage = newReport.ErrorMessage.Substring(0, 450);

                // Yeni rapor ekle
                await _reportRepository.AddAsync(newReport);
                task.PreAnalysisReport = newReport;
            }

            return MapToDto(task);
        }

        public async Task<bool> UpdateTaskStatusAsync(int taskId, UpdateTaskStatusRequest request)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);
            if (task == null) throw new KeyNotFoundException("Task not found.");

            // Both owner and economist can update status (standard users can cancel, economists can move to in-progress/completed)
            if (task.UserId != _currentUserService.UserId && task.EconomistId != _currentUserService.UserId && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Not authorized.");

            var previousStatus = task.Status;
            task.Status = request.Status;
            if (request.Status == ConsultancyTaskStatus.Completed)
            {
                task.CompletedAtUtc = DateTime.UtcNow;
            }

            await _taskRepository.UpdateAsync(task);

            if (previousStatus != request.Status)
            {
                try
                {
                    var payload = new TaskStatusChangedEventDto
                    {
                        TaskId = task.Id,
                        TaskTitle = task.Title,
                        Status = request.Status.ToString(),
                        UpdatedByName = _currentUserService.Email ?? _currentUserService.UserId
                    };

                    if (_currentUserService.IsAdmin)
                    {
                        await _broadcaster.PushTaskStatusChangedAsync(task.UserId, payload);
                        await _broadcaster.PushTaskStatusChangedAsync(task.EconomistId, payload);
                    }
                    else
                    {
                        var recipientId = _currentUserService.UserId == task.UserId
                            ? task.EconomistId
                            : task.UserId;

                        await _broadcaster.PushTaskStatusChangedAsync(recipientId, payload);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to push TaskStatusChanged notification for task {TaskId}", taskId);
                }
            }

            return true;
        }

        public async Task<ConsultancyTaskDto> RateTaskAsync(int taskId, RateTaskRequest request)
        {
            if (_currentUserService.IsEconomist)
                throw new ForbiddenException("Economists cannot rate tasks.");

            var task = await _taskRepository.GetWithPreAnalysisAsync(taskId)
                ?? throw new KeyNotFoundException("Task not found.");

            if (task.UserId != _currentUserService.UserId)
                throw new ForbiddenException("You can only rate your own tasks.");

            if (task.Status != ConsultancyTaskStatus.Completed)
                throw new ApiException("Only completed tasks can be rated.");

            if (task.Rating.HasValue)
                throw new ApiException("This task has already been rated.");

            task.Rating = request.Rating;
            task.RatingFeedback = request.Feedback?.Trim();
            task.RatedAtUtc = DateTime.UtcNow;

            await _taskRepository.UpdateAsync(task);

            try
            {
                var ratedEvent = new TaskRatedEventDto
                {
                    TaskId = task.Id,
                    TaskTitle = task.Title,
                    EconomistId = task.EconomistId,
                    Rating = task.Rating.Value,
                    Feedback = task.RatingFeedback,
                    UserName = _currentUserService.Email ?? _currentUserService.UserId,
                    RatedAtUtc = task.RatedAtUtc.Value
                };
                await _broadcaster.PushTaskRatedAsync(task.EconomistId, ratedEvent);
                await _broadcaster.PushTaskRatedAsync(task.UserId, ratedEvent);
                await _broadcaster.PushTaskRatedForAdminsAsync(ratedEvent);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push TaskRated notification for task {TaskId}", task.Id);
            }

            return MapToDto(task);
        }

        private static ConsultancyTaskDto MapToDto(ConsultancyTask t)
        {
            return new ConsultancyTaskDto
            {
                Id = t.Id,
                UserId = t.UserId,
                EconomistId = t.EconomistId,
                Category = t.Category,
                Title = t.Title,
                Description = t.Description,
                Priority = t.Priority,
                Deadline = t.Deadline,
                Status = t.Status,
                CreatedAtUtc = t.CreatedAtUtc,
                CompletedAtUtc = t.CompletedAtUtc,
                EconomistReport = t.EconomistReport,
                Rating = t.Rating,
                RatingFeedback = t.RatingFeedback,
                RatedAtUtc = t.RatedAtUtc,
                PreAnalysisReport = t.PreAnalysisReport != null ? new PreAnalysisReportDto
                {
                    Id = t.PreAnalysisReport.Id,
                    Summary = t.PreAnalysisReport.Summary,
                    RiskLevel = t.PreAnalysisReport.RiskLevel,
                    MarketOutlook = t.PreAnalysisReport.MarketOutlook,
                    KeyFindings = t.PreAnalysisReport.KeyFindings,
                    RawContent = t.PreAnalysisReport.RawContent,
                    GeneratedAtUtc = t.PreAnalysisReport.GeneratedAtUtc,
                    IsSuccessful = t.PreAnalysisReport.IsSuccessful,
                    ErrorMessage = t.PreAnalysisReport.ErrorMessage
                } : null
            };
        }
    }
}
