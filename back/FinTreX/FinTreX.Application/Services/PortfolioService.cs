using FinTreX.Core.DTOs.Portfolio;
using FinTreX.Core.Entities;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Core.Services
{
    /// <summary>
    /// Service for managing portfolios.
    /// BUSINESS RULE: Economists can READ client portfolios (if assigned) but cannot MODIFY them.
    /// </summary>
    public class PortfolioService : IPortfolioService
    {
        private readonly IPortfolioRepository _portfolioRepository;
        private readonly IPortfolioAssetRepository _assetRepository;
        private readonly IEconomistClientRepository _economistClientRepository;
        private readonly ICurrentUserService _currentUserService;

        public PortfolioService(
            IPortfolioRepository portfolioRepository,
            IPortfolioAssetRepository assetRepository,
            IEconomistClientRepository economistClientRepository,
            ICurrentUserService currentUserService)
        {
            _portfolioRepository = portfolioRepository;
            _assetRepository = assetRepository;
            _economistClientRepository = economistClientRepository;
            _currentUserService = currentUserService;
        }

        public async Task<IReadOnlyList<PortfolioDto>> GetUserPortfoliosAsync()
        {
            var portfolios = await _portfolioRepository.GetByUserIdAsync(_currentUserService.UserId);
            return portfolios.Select(p => MapToDto(p)).ToList().AsReadOnly();
        }

        public async Task<PortfolioDto> GetPortfolioByIdAsync(int portfolioId)
        {
            var portfolio = await _portfolioRepository.GetWithAssetsAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");

            // Accessibility check
            if (portfolio.ApplicationUserId != _currentUserService.UserId)
            {
                // Is this an assigned economist?
                if (_currentUserService.IsEconomist)
                {
                    bool isAssigned = await _economistClientRepository.IsClientAssignedAsync(_currentUserService.UserId, portfolio.ApplicationUserId);
                    if (!isAssigned) throw new ForbiddenException("You are not assigned to this client.");
                }
                else
                {
                    throw new ForbiddenException("You do not own this portfolio.");
                }
            }

            return MapToDto(portfolio);
        }

        public async Task<PortfolioDto> CreatePortfolioAsync(CreatePortfolioRequest request)
        {
            // BUSINESS RULE: Economists cannot create portfolios
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot create portfolios.");

            var portfolio = new Portfolio
            {
                ApplicationUserId = _currentUserService.UserId,
                Name = request.Name,
                Description = request.Description,
                ParentPortfolioId = request.ParentPortfolioId,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _portfolioRepository.AddAsync(portfolio);
            return MapToDto(portfolio);
        }

        public async Task<bool> DeletePortfolioAsync(int portfolioId)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot delete portfolios.");

            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) return false;

            if (portfolio.ApplicationUserId != _currentUserService.UserId)
                throw new ForbiddenException("You do not own this portfolio.");

            await _portfolioRepository.DeleteAsync(portfolio);
            return true;
        }

        public async Task<PortfolioAssetDto> AddAssetAsync(int portfolioId, CreatePortfolioAssetRequest request)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot add assets.");

            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            var asset = new PortfolioAsset
            {
                PortfolioId = portfolioId,
                Symbol = request.Symbol,
                AssetName = request.AssetName,
                AssetType = request.AssetType,
                Quantity = request.Quantity,
                AverageCost = request.AverageCost,
                Currency = request.Currency,
                AcquiredAtUtc = request.AcquiredAtUtc,
                Notes = request.Notes,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _assetRepository.AddAsync(asset);
            return MapAssetToDto(asset);
        }

        public async Task<PortfolioAssetDto> UpdateAssetAsync(int assetId, UpdatePortfolioAssetRequest request)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot update assets.");

            var asset = await _assetRepository.GetByIdAsync(assetId);
            if (asset == null) throw new KeyNotFoundException("Asset not found.");

            // Ownership check through portfolio
            var portfolio = await _portfolioRepository.GetByIdAsync(asset.PortfolioId);
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            if (request.Quantity.HasValue) asset.Quantity = request.Quantity.Value;
            if (request.AverageCost.HasValue) asset.AverageCost = request.AverageCost.Value;
            if (!string.IsNullOrEmpty(request.Notes)) asset.Notes = request.Notes;

            asset.UpdatedAtUtc = DateTime.UtcNow;
            await _assetRepository.UpdateAsync(asset);
            return MapAssetToDto(asset);
        }

        public async Task<bool> RemoveAssetAsync(int assetId)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot remove assets.");

            var asset = await _assetRepository.GetByIdAsync(assetId);
            if (asset == null) return false;

            var portfolio = await _portfolioRepository.GetByIdAsync(asset.PortfolioId);
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            await _assetRepository.DeleteAsync(asset);
            return true;
        }

        public async Task<IReadOnlyList<PortfolioDto>> GetClientPortfoliosAsync(string clientId)
        {
            if (!_currentUserService.IsEconomist && !_currentUserService.IsAdmin)
                throw new ForbiddenException("Only economists or admins can access client portfolios.");

            // Check assignment if economist
            if (_currentUserService.IsEconomist)
            {
                bool isAssigned = await _economistClientRepository.IsClientAssignedAsync(_currentUserService.UserId, clientId);
                if (!isAssigned) throw new ForbiddenException("You are not assigned to this client.");
            }

            var portfolios = await _portfolioRepository.GetByUserIdAsync(clientId);
            return portfolios.Select(p => MapToDto(p)).ToList().AsReadOnly();
        }

        // ── Mapping Helpers (Manual) ─────────────────────────────────────────

        private static PortfolioDto MapToDto(Portfolio p)
        {
            return new PortfolioDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ParentPortfolioId = p.ParentPortfolioId,
                CreatedAtUtc = p.CreatedAtUtc,
                Assets = p.Assets?.Select(MapAssetToDto).ToList() ?? new List<PortfolioAssetDto>(),
                SubPortfolios = p.SubPortfolios?.Select(MapToDto).ToList() ?? new List<PortfolioDto>()
            };
        }

        private static PortfolioAssetDto MapAssetToDto(PortfolioAsset a)
        {
            return new PortfolioAssetDto
            {
                Id = a.Id,
                PortfolioId = a.PortfolioId,
                Symbol = a.Symbol,
                AssetName = a.AssetName,
                AssetType = a.AssetType,
                Quantity = a.Quantity,
                AverageCost = a.AverageCost,
                Currency = a.Currency,
                CurrentValue = a.CurrentValue,
                CurrentValueUpdatedAtUtc = a.CurrentValueUpdatedAtUtc,
                AcquiredAtUtc = a.AcquiredAtUtc,
                Notes = a.Notes
            };
        }
    }
}
