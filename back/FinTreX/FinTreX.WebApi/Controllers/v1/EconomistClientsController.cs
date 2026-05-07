using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class EconomistClientsController : BaseApiController
    {
        private readonly IEconomistClientService _economistClientService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConsultancyTaskRepository _taskRepository;

        public EconomistClientsController(
            IEconomistClientService economistClientService,
            UserManager<ApplicationUser> userManager,
            IConsultancyTaskRepository taskRepository)
        {
            _economistClientService = economistClientService;
            _userManager = userManager;
            _taskRepository = taskRepository;
        }

        /// <summary>Returns approved economists — used by clients when hiring an economist.</summary>
        [HttpGet("economists")]
        public async Task<IActionResult> GetAvailableEconomists()
        {
            var economists = await _userManager.GetUsersInRoleAsync("Economist");
            var approvedEconomists = economists
                .Where(u => u.EconomistStatus == FinTreX.Core.Enums.EconomistStatus.Approved)
                .ToList();

            var economistIds = approvedEconomists.Select(u => u.Id);
            var ratingStats = await _taskRepository.GetRatingStatsByEconomistIdsAsync(economistIds);

            var result = approvedEconomists.Select(u =>
            {
                ratingStats.TryGetValue(u.Id, out var stats);
                return new AvailableEconomistDto
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    UserName = u.UserName,
                    Email = u.Email,
                    AverageRating = stats.Count > 0 ? Math.Round(stats.Average, 1) : null,
                    TotalRatings = stats.Count
                };
            });

            return Ok(result);
        }

        [HttpGet("my-economists")]
        public async Task<IActionResult> GetMyEconomists()
        {
            var assignments = await _economistClientService.GetMyEconomistsAsync();

            var result = new List<EconomistClientDto>();
            foreach (var a in assignments)
            {
                var economist = await _userManager.FindByIdAsync(a.EconomistId);
                result.Add(new EconomistClientDto
                {
                    Id = a.Id,
                    EconomistId = a.EconomistId,
                    ClientId = a.ClientId,
                    EconomistName = economist != null
                        ? $"{economist.FirstName} {economist.LastName}".Trim()
                        : a.EconomistId,
                    AssignedAtUtc = a.AssignedAtUtc,
                    IsActive = a.IsActive,
                    Notes = a.Notes
                });
            }

            return Ok(result);
        }

        [HttpGet("clients")]
        [Authorize(Roles = "Economist,Admin")]
        public async Task<IActionResult> GetMyClients()
        {
            var clients = await _economistClientService.GetMyClientsAsync();

            var result = new List<EconomistClientDto>();
            foreach (var c in clients)
            {
                var clientUser = await _userManager.FindByIdAsync(c.ClientId);
                result.Add(new EconomistClientDto
                {
                    Id = c.Id,
                    EconomistId = c.EconomistId,
                    ClientId = c.ClientId,
                    ClientName = clientUser != null
                        ? $"{clientUser.FirstName} {clientUser.LastName}".Trim()
                        : c.ClientId,
                    AssignedAtUtc = c.AssignedAtUtc,
                    IsActive = c.IsActive,
                    Notes = c.Notes
                });
            }

            return Ok(result);
        }

        [HttpGet("admin/clients/{clientId}/economists")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminGetClientEconomists(string clientId)
        {
            var assignments = await _economistClientService.AdminGetClientEconomistsAsync(clientId);

            var result = new List<EconomistClientDto>();
            foreach (var a in assignments)
            {
                var economist = await _userManager.FindByIdAsync(a.EconomistId);
                result.Add(new EconomistClientDto
                {
                    Id = a.Id,
                    EconomistId = a.EconomistId,
                    ClientId = a.ClientId,
                    EconomistName = economist != null
                        ? $"{economist.FirstName} {economist.LastName}".Trim()
                        : a.EconomistId,
                    AssignedAtUtc = a.AssignedAtUtc,
                    IsActive = a.IsActive,
                    Notes = a.Notes
                });
            }

            return Ok(result);
        }

        [HttpPost("assign")]
        public async Task<IActionResult> AssignEconomist([Required] string economistId, string notes = null)
        {
            var assignment = await _economistClientService.AssignEconomistAsync(economistId, notes);
            return Ok(assignment);
        }

        [HttpPost("assign-random")]
        public async Task<IActionResult> AssignRandomEconomist()
        {
            var economists = await _userManager.GetUsersInRoleAsync("Economist");
            var approved = economists
                .Where(u => u.EconomistStatus == FinTreX.Core.Enums.EconomistStatus.Approved)
                .ToList();

            if (!approved.Any())
                return BadRequest(new { message = "Şu an onaylı ekonomist bulunmuyor." });

            var random = new System.Random();
            var picked = approved.ElementAt(random.Next(approved.Count));

            var assignment = await _economistClientService.AssignEconomistAsync(picked.Id);
            return Ok(assignment);
        }

        [HttpPut("admin/assignments/{assignmentId:int}/change")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminChangeAssignment(
            int assignmentId,
            [FromBody] AdminChangeEconomistAssignmentRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.NewEconomistId))
                return BadRequest(new { message = "Yeni ekonomist seçilmelidir." });

            var newEconomist = await _userManager.FindByIdAsync(request.NewEconomistId);
            if (newEconomist == null || !await _userManager.IsInRoleAsync(newEconomist, "Economist"))
                return BadRequest(new { message = "Seçilen kullanıcı ekonomist değil." });

            var assignment = await _economistClientService.AdminChangeAssignmentAsync(
                assignmentId,
                request.NewEconomistId,
                request.Notes);

            assignment.EconomistName = $"{newEconomist.FirstName} {newEconomist.LastName}".Trim();
            return Ok(assignment);
        }

        [HttpGet("admin/economists/{economistId}/ratings")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminGetEconomistRatings(string economistId)
        {
            var economist = await _userManager.FindByIdAsync(economistId);
            if (economist == null || !await _userManager.IsInRoleAsync(economist, "Economist"))
                return NotFound(new { message = "Ekonomist bulunamadı." });

            var tasks = await _taskRepository.GetRatedTasksByEconomistIdAsync(economistId);

            var result = new List<EconomistRatingDto>();
            foreach (var t in tasks)
            {
                var user = await _userManager.FindByIdAsync(t.UserId);
                result.Add(new EconomistRatingDto
                {
                    TaskId = t.Id,
                    TaskTitle = t.Title,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : t.UserId,
                    Rating = t.Rating!.Value,
                    Feedback = t.RatingFeedback,
                    RatedAtUtc = t.RatedAtUtc!.Value
                });
            }

            return Ok(result);
        }

        [HttpPut("admin/assignments/{assignmentId:int}/remove")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminRemoveAssignment(
            int assignmentId,
            [FromBody] AdminChangeEconomistAssignmentRequest request)
        {
            var assignment = await _economistClientService.AdminRemoveAssignmentAsync(assignmentId, request?.Notes);
            return Ok(assignment);
        }

    }
}
