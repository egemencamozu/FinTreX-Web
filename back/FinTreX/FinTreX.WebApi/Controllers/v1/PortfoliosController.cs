using FinTreX.Core.DTOs.Portfolio;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class PortfoliosController : BaseApiController
    {
        private readonly IPortfolioService _portfolioService;

        public PortfoliosController(IPortfolioService portfolioService)
        {
            _portfolioService = portfolioService;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyPortfolios()
        {
            var portfolios = await _portfolioService.GetUserPortfoliosAsync();
            return Ok(portfolios);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPortfolioById(int id)
        {
            var portfolio = await _portfolioService.GetPortfolioByIdAsync(id);
            return Ok(portfolio);
        }

        [HttpGet("{id}/history")]
        public async Task<IActionResult> GetPortfolioHistory(int id, [FromQuery] string? interval = "30d", [FromQuery] string? currency = "TRY")
        {
            var history = await _portfolioService.GetPortfolioHistoryAsync(id, interval, currency);
            return Ok(history);
        }

        [HttpGet("{id}/overview")]
        public async Task<IActionResult> GetPortfolioOverview(int id, [FromQuery] string? currency = "TRY")
        {
            var overview = await _portfolioService.GetPortfolioOverviewAsync(id, currency);
            return Ok(overview);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePortfolio(CreatePortfolioRequest request)
        {
            var created = await _portfolioService.CreatePortfolioAsync(request);
            return CreatedAtAction(nameof(GetPortfolioById), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePortfolio(int id, UpdatePortfolioRequest request)
        {
            var updated = await _portfolioService.UpdatePortfolioAsync(id, request);
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePortfolio(int id)
        {
            var deleted = await _portfolioService.DeletePortfolioAsync(id);
            if (!deleted) return NotFound("Portfolio not found.");
            return NoContent();
        }

        // --- Asset Endpoints ---

        [HttpPost("{id}/assets")]
        public async Task<IActionResult> AddAsset(int id, CreatePortfolioAssetRequest request)
        {
            var asset = await _portfolioService.AddAssetAsync(id, request);
            return Ok(asset);
        }

        [HttpPut("assets/{assetId}")]
        public async Task<IActionResult> UpdateAsset(int assetId, UpdatePortfolioAssetRequest request)
        {
            var asset = await _portfolioService.UpdateAssetAsync(assetId, request);
            return Ok(asset);
        }

        [HttpDelete("assets/{assetId}")]
        public async Task<IActionResult> RemoveAsset(int assetId)
        {
            var removed = await _portfolioService.RemoveAssetAsync(assetId);
            if (!removed) return NotFound("Asset not found.");
            return NoContent();
        }

        // --- Transaction Endpoints ---

        [HttpGet("{id}/transactions")]
        public async Task<IActionResult> GetTransactions(int id)
        {
            var transactions = await _portfolioService.GetTransactionsAsync(id);
            return Ok(transactions);
        }

        [HttpPost("{id}/transactions")]
        public async Task<IActionResult> AddTransaction(int id, CreatePortfolioTransactionRequest request)
        {
            var transaction = await _portfolioService.AddTransactionAsync(id, request);
            return Ok(transaction);
        }

        [HttpDelete("transactions/{transactionId}")]
        public async Task<IActionResult> DeleteTransaction(int transactionId)
        {
            var deleted = await _portfolioService.DeleteTransactionAsync(transactionId);
            if (!deleted) return NotFound("Transaction not found.");
            return NoContent();
        }

        [HttpPatch("{id}/economist-visibility")]
        public async Task<IActionResult> SetEconomistVisibility(int id, SetPortfolioEconomistVisibilityRequest request)
        {
            var updated = await _portfolioService.SetPortfolioEconomistVisibilityAsync(id, request.IsHiddenFromEconomists);
            return Ok(updated);
        }

        // --- Economist Endpoints ---

        [HttpGet("client/{clientId}")]
        [Authorize(Roles = "Economist,Admin")]
        public async Task<IActionResult> GetClientPortfolios(string clientId)
        {
            var portfolios = await _portfolioService.GetClientPortfoliosAsync(clientId);
            return Ok(portfolios);
        }
    }
}
