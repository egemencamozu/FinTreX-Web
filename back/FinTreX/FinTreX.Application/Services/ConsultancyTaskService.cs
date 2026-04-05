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
        private readonly ILogger<ConsultancyTaskService> _logger;

        public ConsultancyTaskService(
            IConsultancyTaskRepository taskRepository,
            IEconomistClientRepository assignmentRepository,
            ICurrentUserService currentUserService,
            IPreAnalysisService preAnalysisService,
            IPreAnalysisReportRepository reportRepository,
            ILogger<ConsultancyTaskService> logger)
        {
            _taskRepository = taskRepository;
            _assignmentRepository = assignmentRepository;
            _currentUserService = currentUserService;
            _preAnalysisService = preAnalysisService;
            _reportRepository = reportRepository;
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
                Deadline = request.Deadline,
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

            task.Status = request.Status;
            if (request.Status == ConsultancyTaskStatus.Completed)
            {
                task.CompletedAtUtc = DateTime.UtcNow;
            }

            await _taskRepository.UpdateAsync(task);
            return true;
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
