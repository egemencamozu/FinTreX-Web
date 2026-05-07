using System.Threading.Tasks;
using FinTreX.Core.DTOs.Watchlist;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class WatchlistsController : BaseApiController
    {
        private readonly IWatchlistService _watchlistService;

        public WatchlistsController(IWatchlistService watchlistService)
        {
            _watchlistService = watchlistService;
        }

        // ── Watchlist CRUD ───────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetMyWatchlists()
        {
            var lists = await _watchlistService.GetMyWatchlistsAsync();
            return Ok(lists);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var dto = await _watchlistService.GetByIdAsync(id);
            return Ok(dto);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateWatchlistRequest request)
        {
            var created = await _watchlistService.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPatch("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateWatchlistRequest request)
        {
            var updated = await _watchlistService.UpdateAsync(id, request);
            return Ok(updated);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _watchlistService.DeleteAsync(id);
            if (!deleted) return NotFound("Watchlist not found.");
            return NoContent();
        }

        // ── Items ────────────────────────────────────────────────────────────

        [HttpGet("{id:int}/items")]
        public async Task<IActionResult> GetItems(int id)
        {
            var items = await _watchlistService.GetItemsAsync(id);
            return Ok(items);
        }

        [HttpPost("{id:int}/items")]
        public async Task<IActionResult> AddItem(int id, [FromBody] AddWatchlistItemRequest request)
        {
            var item = await _watchlistService.AddItemAsync(id, request);
            return Ok(item);
        }

        [HttpDelete("{id:int}/items/{itemId:int}")]
        public async Task<IActionResult> RemoveItem(int id, int itemId)
        {
            var removed = await _watchlistService.RemoveItemAsync(id, itemId);
            if (!removed) return NotFound("Item not found.");
            return NoContent();
        }

        // ── Toggle symbol across lists (modal save) ──────────────────────────

        [HttpPost("toggle-symbol")]
        public async Task<IActionResult> ToggleSymbol([FromBody] ToggleSymbolRequest request)
        {
            var result = await _watchlistService.ToggleSymbolAsync(request);
            return Ok(result);
        }

        // ── Convenience: all favorite symbols (for Markets star indicator) ───

        [HttpGet("favorites")]
        public async Task<IActionResult> GetFavoriteSymbols()
        {
            var symbols = await _watchlistService.GetAllFavoriteSymbolsAsync();
            return Ok(symbols);
        }
    }
}
