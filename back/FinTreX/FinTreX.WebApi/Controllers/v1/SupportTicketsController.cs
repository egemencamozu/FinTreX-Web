using FinTreX.Core.DTOs.Support;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class SupportTicketsController : BaseApiController
    {
        private readonly ISupportTicketService _supportTicketService;
        private readonly UserManager<ApplicationUser> _userManager;

        public SupportTicketsController(
            ISupportTicketService supportTicketService,
            UserManager<ApplicationUser> userManager)
        {
            _supportTicketService = supportTicketService;
            _userManager = userManager;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateSupportTicketRequest request)
        {
            var ticket = await _supportTicketService.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = ticket.Id }, ticket);
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyTickets()
        {
            var tickets = await _supportTicketService.GetMyTicketsAsync();
            return Ok(tickets);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var ticket = await _supportTicketService.GetByIdAsync(id);
            return Ok(await EnrichAsync(ticket));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("open-count")]
        public async Task<IActionResult> GetOpenCount()
        {
            var count = await _supportTicketService.GetOpenCountAsync();
            return Ok(new { count });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var tickets = await _supportTicketService.GetAllAsync();
            var enriched = new List<SupportTicketDto>(tickets.Count);
            foreach (var t in tickets)
                enriched.Add(await EnrichAsync(t));
            return Ok(enriched);
        }

        [Authorize(Roles = "Admin")]
        [HttpPatch("{id}")]
        public async Task<IActionResult> Update(int id, UpdateSupportTicketRequest request)
        {
            var ticket = await _supportTicketService.UpdateAsync(id, request);
            return Ok(await EnrichAsync(ticket));
        }

        [HttpGet("{id}/messages")]
        public async Task<IActionResult> GetMessages(int id)
        {
            var messages = await _supportTicketService.GetMessagesAsync(id);
            return Ok(messages);
        }

        [HttpPost("{id}/messages")]
        public async Task<IActionResult> AddMessage(int id, [FromBody] CreateSupportTicketMessageRequest request)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            var senderName = currentUser != null
                ? $"{currentUser.FirstName} {currentUser.LastName}".Trim()
                : string.Empty;

            var message = await _supportTicketService.AddMessageAsync(id, request.Body, senderName);
            return Ok(message);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMyTicket(int id)
        {
            await _supportTicketService.DeleteMyTicketAsync(id);
            return NoContent();
        }

        private async Task<SupportTicketDto> EnrichAsync(SupportTicketDto dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.UserId))
            {
                var user = await _userManager.FindByIdAsync(dto.UserId);
                if (user != null)
                {
                    dto.UserName = $"{user.FirstName} {user.LastName}".Trim();
                    dto.UserEmail = user.Email;

                    var roles = await _userManager.GetRolesAsync(user);
                    dto.UserRole = roles.FirstOrDefault(r => r != "Admin") ?? roles.FirstOrDefault() ?? string.Empty;
                }
            }
            return dto;
        }
    }
}
