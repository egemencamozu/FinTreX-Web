using FinTreX.Core.DTOs.Tasks;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class ConsultancyTasksController : BaseApiController
    {
        private readonly IConsultancyTaskService _taskService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly Core.Interfaces.ICurrentUserService _currentUserService;

        public ConsultancyTasksController(
            IConsultancyTaskService taskService,
            UserManager<ApplicationUser> userManager,
            Core.Interfaces.ICurrentUserService currentUserService)
        {
            _taskService = taskService;
            _userManager = userManager;
            _currentUserService = currentUserService;
        }

        [HttpGet("debug")]
        public IActionResult Debug()
        {
            return Ok(new
            {
                userId = _currentUserService.UserId,
                roles = _currentUserService.Roles,
                isEconomist = _currentUserService.IsEconomist
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetMyTasks()
        {
            var tasks = await _taskService.GetMyTasksAsync();

            var result = new List<ConsultancyTaskDto>();
            foreach (var t in tasks)
            {
                var user = await _userManager.FindByIdAsync(t.UserId);
                var economist = await _userManager.FindByIdAsync(t.EconomistId);

                result.Add(new ConsultancyTaskDto
                {
                    Id = t.Id,
                    UserId = t.UserId,
                    UserName = user != null
                        ? $"{user.FirstName} {user.LastName}".Trim()
                        : t.UserId,
                    EconomistId = t.EconomistId,
                    EconomistName = economist != null
                        ? $"{economist.FirstName} {economist.LastName}".Trim()
                        : t.EconomistId,
                    Category = t.Category,
                    Title = t.Title,
                    Description = t.Description,
                    Priority = t.Priority,
                    Deadline = t.Deadline,
                    Status = t.Status,
                    CreatedAtUtc = t.CreatedAtUtc,
                    CompletedAtUtc = t.CompletedAtUtc,
                    PreAnalysisReport = t.PreAnalysisReport
                });
            }

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTaskById(int id)
        {
            var task = await _taskService.GetTaskByIdAsync(id);
            return Ok(task);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask(CreateConsultancyTaskRequest request)
        {
            var task = await _taskService.CreateTaskAsync(request);
            return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateTaskStatus(int id, UpdateTaskStatusRequest request)
        {
            await _taskService.UpdateTaskStatusAsync(id, request);
            return NoContent();
        }

        [HttpPost("{id}/generate-analysis")]
        public async Task<IActionResult> GeneratePreAnalysis(int id)
        {
            var task = await _taskService.GeneratePreAnalysisAsync(id);
            return Ok(task);
        }
    }
}
