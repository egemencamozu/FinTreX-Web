using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class EconomistClientsController : BaseApiController
    {
        private readonly IEconomistClientService _economistClientService;
        private readonly UserManager<ApplicationUser> _userManager;

        public EconomistClientsController(
            IEconomistClientService economistClientService,
            UserManager<ApplicationUser> userManager)
        {
            _economistClientService = economistClientService;
            _userManager = userManager;
        }

        /// <summary>Returns all users with the Economist role — used by clients when hiring an economist.</summary>
        [HttpGet("economists")]
        public async Task<IActionResult> GetAvailableEconomists()
        {
            var economists = await _userManager.GetUsersInRoleAsync("Economist");
            var result = economists.Select(u => new AvailableEconomistDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                UserName = u.UserName,
                Email = u.Email
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

        [HttpPost("assign")]
        public async Task<IActionResult> AssignEconomist([Required] string economistId, string notes = null)
        {
            var assignment = await _economistClientService.AssignEconomistAsync(economistId, notes);
            return Ok(assignment);
        }

        [HttpDelete("{assignmentId}")]
        public async Task<IActionResult> RemoveAssignment(int assignmentId)
        {
            var success = await _economistClientService.RemoveEconomistAsync(assignmentId);
            if (!success) return NotFound("Assignment not found.");
            return NoContent();
        }
    }
}
