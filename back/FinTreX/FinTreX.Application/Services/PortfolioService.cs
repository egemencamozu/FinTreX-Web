using FinTreX.Core.DTOs.Portfolio;
using FinTreX.Core.Entities;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

#nullable enable
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
        private readonly IPortfolioTransactionRepository _transactionRepository;
        private readonly IEconomistClientRepository _economistClientRepository;
        private readonly IPortfolioValueSnapshotRepository _portfolioValueSnapshotRepository;
        private readonly IUserSubscriptionRepository _subscriptionRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly IMarketDataCache _marketDataCache;
        private readonly IBistSubscriptionManager? _bistSubscriptionManager;
        private readonly ILogger<PortfolioService> _logger;

        public PortfolioService(
            IPortfolioRepository portfolioRepository,
            IPortfolioAssetRepository assetRepository,
            IPortfolioTransactionRepository transactionRepository,
            IEconomistClientRepository economistClientRepository,
            IPortfolioValueSnapshotRepository portfolioValueSnapshotRepository,
            IUserSubscriptionRepository subscriptionRepository,
            ICurrentUserService currentUserService,
            IMarketDataCache marketDataCache,
            ILogger<PortfolioService> logger,
            IBistSubscriptionManager? bistSubscriptionManager = null)
        {
            _portfolioRepository = portfolioRepository;
            _assetRepository = assetRepository;
            _transactionRepository = transactionRepository;
            _economistClientRepository = economistClientRepository;
            _portfolioValueSnapshotRepository = portfolioValueSnapshotRepository;
            _subscriptionRepository = subscriptionRepository;
            _currentUserService = currentUserService;
            _marketDataCache = marketDataCache;
            _logger = logger;
            _bistSubscriptionManager = bistSubscriptionManager;
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

            await EnsurePortfolioAccessAsync(portfolio);

            return MapToDto(portfolio);
        }

        public async Task<PortfolioDto> CreatePortfolioAsync(CreatePortfolioRequest request)
        {
            // BUSINESS RULE: Economists cannot create portfolios
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot create portfolios.");

            // BUSINESS RULE: Enforce subscription portfolio limit
            var subscription = await _subscriptionRepository.GetWithPlanAsync(_currentUserService.UserId);
            if (subscription?.SubscriptionPlan != null)
            {
                var maxPortfolios = subscription.SubscriptionPlan.MaxPortfolios;
                if (maxPortfolios < 999)
                {
                    var existing = await _portfolioRepository.GetByUserIdAsync(_currentUserService.UserId);
                    if (existing.Count >= maxPortfolios)
                        throw new ApiException($"Abonelik planınız en fazla {maxPortfolios} portfolyo oluşturmanıza izin veriyor. Limitinize ulaştınız.");
                }
            }

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

        public async Task<PortfolioDto> UpdatePortfolioAsync(int portfolioId, UpdatePortfolioRequest request)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot update portfolios.");

            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");

            if (portfolio.ApplicationUserId != _currentUserService.UserId)
                throw new ForbiddenException("You do not own this portfolio.");

            portfolio.Name = request.Name;
            if (request.Description != null) portfolio.Description = request.Description;

            await _portfolioRepository.UpdateAsync(portfolio);
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

            var existingAsset = (await _assetRepository.GetByPortfolioIdAsync(portfolioId))
                .FirstOrDefault(a =>
                    a.AssetType == request.AssetType &&
                    string.Equals(a.Symbol, request.Symbol, StringComparison.OrdinalIgnoreCase));

            PortfolioAsset asset;
            if (existingAsset is not null)
            {
                if (!string.Equals(existingAsset.Currency, request.Currency, StringComparison.OrdinalIgnoreCase))
                {
                    throw new ApiException("Aynı varlık için farklı para birimi kullanılamaz.");
                }

                var previousQuantity = existingAsset.Quantity;
                var previousCostBasis = previousQuantity * existingAsset.AverageCost;
                var newCostBasis = request.Quantity * request.AverageCost;
                var mergedQuantity = previousQuantity + request.Quantity;

                existingAsset.Quantity = mergedQuantity;
                existingAsset.AverageCost = mergedQuantity > 0m
                    ? (previousCostBasis + newCostBasis) / mergedQuantity
                    : request.AverageCost;
                existingAsset.AssetName = request.AssetName;
                if (!string.IsNullOrWhiteSpace(request.Notes))
                {
                    existingAsset.Notes = request.Notes;
                }

                existingAsset.UpdatedAtUtc = DateTime.UtcNow;
                await _assetRepository.UpdateAsync(existingAsset);
                asset = existingAsset;
            }
            else
            {
                asset = new PortfolioAsset
                {
                    PortfolioId = portfolioId,
                    Symbol = request.Symbol,
                    AssetName = request.AssetName,
                    AssetType = request.AssetType,
                    Quantity = request.Quantity,
                    AverageCost = request.AverageCost,
                    Currency = request.Currency,
                    // Business decision: portfolio history starts from the moment user adds the asset.
                    AcquiredAtUtc = DateTime.UtcNow,
                    Notes = request.Notes,
                    CreatedAtUtc = DateTime.UtcNow
                };

                await _assetRepository.AddAsync(asset);
            }

            var executedAtUtc = request.AcquiredAtUtc == default ? DateTime.UtcNow : request.AcquiredAtUtc;
            if (executedAtUtc.Kind == DateTimeKind.Unspecified)
            {
                executedAtUtc = DateTime.SpecifyKind(executedAtUtc, DateTimeKind.Utc);
            }

            var transaction = new PortfolioTransaction
            {
                PortfolioId = portfolioId,
                Symbol = request.Symbol,
                AssetName = request.AssetName,
                AssetType = request.AssetType,
                Type = TransactionType.Buy,
                Quantity = request.Quantity,
                Price = request.AverageCost,
                Currency = request.Currency,
                Notes = request.Notes,
                ExecutedAtUtc = executedAtUtc,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _transactionRepository.AddAsync(transaction);

            if (asset.AssetType == AssetType.BIST && _bistSubscriptionManager is not null)
            {
                try
                {
                    _bistSubscriptionManager.RequestSubscription(asset.Symbol);
                }
                catch (Exception ex)
                {
                    // Non-critical: stream will pick it up on next reconnect if this fails.
                    _logger.LogWarning(ex, "Failed to request dynamic BIST subscription for {Symbol}.", asset.Symbol);
                }
            }

            await TryWriteImmediateSnapshotAsync(portfolioId);

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

            await TryWriteImmediateSnapshotAsync(asset.PortfolioId);

            return MapAssetToDto(asset);
        }

        public async Task<bool> RemoveAssetAsync(int assetId)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot remove assets.");

            var asset = await _assetRepository.GetByIdAsync(assetId);
            if (asset == null) return false;

            var portfolio = await _portfolioRepository.GetByIdAsync(asset.PortfolioId);
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            var portfolioId = asset.PortfolioId;

            if (asset.Quantity > 0m)
            {
                var unitPrice = ResolveSnapshotUnitPrice(asset);
                var removalTransaction = new PortfolioTransaction
                {
                    PortfolioId = portfolioId,
                    Symbol = asset.Symbol,
                    AssetName = asset.AssetName,
                    AssetType = asset.AssetType,
                    Type = TransactionType.Sell,
                    Quantity = asset.Quantity,
                    Price = unitPrice,
                    Currency = asset.Currency,
                    Notes = null,
                    ExecutedAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow
                };

                await _transactionRepository.AddAsync(removalTransaction);
            }

            await _assetRepository.DeleteAsync(asset);

            await TryWriteImmediateSnapshotAsync(portfolioId);

            return true;
        }

        public async Task<PortfolioOverviewDto> GetPortfolioOverviewAsync(int portfolioId, string? currency)
        {
            var portfolio = await _portfolioRepository.GetWithAssetsAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");

            await EnsurePortfolioAccessAsync(portfolio);

            var targetCurrency = NormalizeTargetCurrency(currency);
            var usdTry = ResolveUsdTryRate();
            var generatedAtUtc = DateTime.UtcNow;
            var assets = portfolio.Assets ?? new List<PortfolioAsset>();

            decimal totalValue = 0m;
            decimal totalCost = 0m;
            var allocationsBySymbol = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            var performances = new List<PortfolioOverviewAssetPerformanceDto>(assets.Count);

            foreach (var asset in assets)
            {
                var (livePrice, _) = ResolveCurrentValue(asset);
                var currentUnitPrice = livePrice ?? asset.CurrentValue ?? asset.AverageCost;

                var rawValue = asset.Quantity * currentUnitPrice;
                var rawCost = asset.Quantity * asset.AverageCost;

                var convertedValue = ConvertSnapshotCurrency(rawValue, asset.Currency, targetCurrency, usdTry);
                var convertedCost = ConvertSnapshotCurrency(rawCost, asset.Currency, targetCurrency, usdTry);

                totalValue += convertedValue;
                totalCost += convertedCost;

                if (allocationsBySymbol.TryGetValue(asset.Symbol, out var existing))
                {
                    allocationsBySymbol[asset.Symbol] = existing + convertedValue;
                }
                else
                {
                    allocationsBySymbol[asset.Symbol] = convertedValue;
                }

                var changePercent = asset.AverageCost > 0m
                    ? ((currentUnitPrice - asset.AverageCost) / asset.AverageCost) * 100m
                    : 0m;

                performances.Add(new PortfolioOverviewAssetPerformanceDto
                {
                    Symbol = asset.Symbol,
                    AssetType = asset.AssetType,
                    Value = Math.Round(Math.Abs(convertedValue - convertedCost), 2),
                    ChangePercent = Math.Round(changePercent, 2),
                });
            }

            var totalPnl = totalValue - totalCost;
            var totalPnlPercent = totalCost > 0m ? (totalPnl / totalCost) * 100m : 0m;

            var allocationTotal = allocationsBySymbol.Values.Sum();
            var allocations = allocationsBySymbol
                .Select(x => new PortfolioOverviewAllocationDto
                {
                    Label = x.Key,
                    Value = Math.Round(x.Value, 2),
                    WeightPercent = allocationTotal > 0m ? Math.Round((x.Value / allocationTotal) * 100m, 2) : 0m,
                })
                .OrderByDescending(x => x.WeightPercent)
                .ToList();

            return new PortfolioOverviewDto
            {
                PortfolioId = portfolioId,
                Currency = targetCurrency,
                TotalValue = Math.Round(totalValue, 2),
                TotalCost = Math.Round(totalCost, 2),
                TotalPnl = Math.Round(totalPnl, 2),
                TotalPnlPercent = Math.Round(totalPnlPercent, 2),
                UsdTryRate = usdTry > 0m ? usdTry : null,
                GeneratedAtUtc = generatedAtUtc,
                Allocations = allocations,
                AssetPerformances = performances,
            };
        }

        public async Task<IReadOnlyList<PortfolioTransactionDto>> GetTransactionsAsync(int portfolioId)
        {
            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");
            await EnsurePortfolioAccessAsync(portfolio);

            var transactions = await _transactionRepository.GetByPortfolioIdAsync(portfolioId);
            return transactions.Select(MapTransactionToDto).ToList().AsReadOnly();
        }

        public async Task<PortfolioTransactionDto> AddTransactionAsync(int portfolioId, CreatePortfolioTransactionRequest request)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot add transactions.");

            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            var transaction = new PortfolioTransaction
            {
                PortfolioId = portfolioId,
                Symbol = request.Symbol,
                AssetName = request.AssetName,
                AssetType = request.AssetType,
                Type = request.Type,
                Quantity = request.Quantity,
                Price = request.Price,
                Currency = request.Currency,
                Fees = request.Fees,
                Notes = request.Notes,
                ExecutedAtUtc = request.ExecutedAtUtc,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _transactionRepository.AddAsync(transaction);
            return MapTransactionToDto(transaction);
        }

        public async Task<bool> DeleteTransactionAsync(int transactionId)
        {
            if (_currentUserService.IsEconomist) throw new ForbiddenException("Economists cannot delete transactions.");

            var transaction = await _transactionRepository.GetByIdAsync(transactionId);
            if (transaction == null) return false;

            var portfolio = await _portfolioRepository.GetByIdAsync(transaction.PortfolioId);
            if (portfolio.ApplicationUserId != _currentUserService.UserId) throw new ForbiddenException("Not authorized.");

            await _transactionRepository.DeleteAsync(transaction);
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

            // Admins see all portfolios; economists only see those the user hasn't hidden.
            if (_currentUserService.IsEconomist)
                portfolios = portfolios.Where(p => !p.IsHiddenFromEconomists).ToList();

            return portfolios.Select(p => MapToDto(p)).ToList().AsReadOnly();
        }

        public async Task<PortfolioDto> SetPortfolioEconomistVisibilityAsync(int portfolioId, bool isHidden)
        {
            if (_currentUserService.IsEconomist)
                throw new ForbiddenException("Economists cannot change portfolio visibility settings.");

            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");

            if (portfolio.ApplicationUserId != _currentUserService.UserId)
                throw new ForbiddenException("You do not own this portfolio.");

            portfolio.IsHiddenFromEconomists = isHidden;
            portfolio.UpdatedAtUtc = DateTime.UtcNow;
            await _portfolioRepository.UpdateAsync(portfolio);

            return MapToDto(portfolio);
        }

        public async Task<PortfolioHistoryDto> GetPortfolioHistoryAsync(int portfolioId, string? interval, string? currency)
        {
            var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
            if (portfolio == null) throw new KeyNotFoundException("Portfolio not found.");

            await EnsurePortfolioAccessAsync(portfolio);

            var normalizedInterval = NormalizeInterval(interval);
            var targetCurrency = NormalizeTargetCurrency(currency);
            var now = DateTime.UtcNow;
            var startUtc = await ResolveHistoryStartUtcAsync(portfolioId, normalizedInterval, now);

            var snapshots = await _portfolioValueSnapshotRepository.GetRangeAsync(portfolioId, startUtc, now);
            var sampledSnapshots = DownsampleSnapshots(snapshots, ResolveMaxPointCount(normalizedInterval));

            var culture = CultureInfo.GetCultureInfo("tr-TR");
            var labels = sampledSnapshots.Select(x => FormatLabel(normalizedInterval, x.CapturedAtUtc, culture)).ToList();
            var values = sampledSnapshots
                .Select(x => targetCurrency == "USD" ? x.TotalValueUsd : x.TotalValueTry)
                .Select(x => Math.Round(x, 2))
                .ToList();

            var responseStart = sampledSnapshots.Count > 0 ? sampledSnapshots[0].CapturedAtUtc : startUtc;
            var responseEnd = sampledSnapshots.Count > 0 ? sampledSnapshots[^1].CapturedAtUtc : now;

            return new PortfolioHistoryDto
            {
                Interval = normalizedInterval,
                Currency = targetCurrency,
                StartUtc = responseStart,
                EndUtc = responseEnd,
                Labels = labels,
                Values = values
            };
        }

        private async Task EnsurePortfolioAccessAsync(Portfolio portfolio)
        {
            if (portfolio.ApplicationUserId == _currentUserService.UserId)
            {
                return;
            }

            if (_currentUserService.IsEconomist)
            {
                bool isAssigned = await _economistClientRepository.IsClientAssignedAsync(_currentUserService.UserId, portfolio.ApplicationUserId);
                if (!isAssigned) throw new ForbiddenException("You are not assigned to this client.");
                if (portfolio.IsHiddenFromEconomists) throw new ForbiddenException("This portfolio is not visible to economists.");
                return;
            }

            throw new ForbiddenException("You do not own this portfolio.");
        }

        private static string NormalizeInterval(string? interval)
        {
            var candidate = (interval ?? string.Empty).Trim().ToLowerInvariant();
            return candidate switch
            {
                "24h" => "24h",
                "7d" => "7d",
                "30d" => "30d",
                "90d" => "90d",
                "all" => "all",
                _ => "30d",
            };
        }

        private static string NormalizeTargetCurrency(string? currency)
        {
            var candidate = (currency ?? string.Empty).Trim().ToUpperInvariant();
            return candidate switch
            {
                "USD" => "USD",
                _ => "TRY",
            };
        }

        private async Task<DateTime> ResolveHistoryStartUtcAsync(int portfolioId, string interval, DateTime nowUtc)
        {
            if (interval == "all")
            {
                var firstSnapshot = await _portfolioValueSnapshotRepository.GetFirstSnapshotAtUtcAsync(portfolioId);
                if (firstSnapshot.HasValue && firstSnapshot.Value <= nowUtc)
                {
                    return firstSnapshot.Value;
                }

                return nowUtc;
            }

            var startUtc = interval switch
            {
                "24h" => nowUtc.AddHours(-24),
                "7d" => nowUtc.AddDays(-7),
                "30d" => nowUtc.AddDays(-30),
                "90d" => nowUtc.AddDays(-90),
                _ => nowUtc.AddDays(-30),
            };

            return startUtc > nowUtc ? nowUtc : startUtc;
        }

        private static int ResolveMaxPointCount(string interval)
        {
            return interval switch
            {
                "24h" => 96,
                "7d" => 168,
                "30d" => 180,
                "90d" => 180,
                "all" => 240,
                _ => 180,
            };
        }

        private static List<PortfolioValueSnapshot> DownsampleSnapshots(IReadOnlyList<PortfolioValueSnapshot> snapshots, int maxPoints)
        {
            if (snapshots.Count == 0)
            {
                return new List<PortfolioValueSnapshot>();
            }

            if (snapshots.Count <= maxPoints)
            {
                return snapshots.ToList();
            }

            if (maxPoints <= 1)
            {
                return new List<PortfolioValueSnapshot> { snapshots[^1] };
            }

            var result = new List<PortfolioValueSnapshot>(maxPoints);
            var lastIndex = snapshots.Count - 1;

            for (var i = 0; i < maxPoints; i++)
            {
                var ratio = i / (double)(maxPoints - 1);
                var index = (int)Math.Round(ratio * lastIndex);
                result.Add(snapshots[index]);
            }

            return result;
        }

        private static string FormatLabel(string interval, DateTime timestampUtc, CultureInfo culture)
        {
            return interval switch
            {
                "24h" => timestampUtc.ToLocalTime().ToString("HH:mm", culture),
                "7d" => timestampUtc.ToLocalTime().ToString("dd MMM", culture),
                "30d" => timestampUtc.ToLocalTime().ToString("dd MMM", culture),
                "90d" => timestampUtc.ToLocalTime().ToString("dd MMM", culture),
                "all" => FormatAllTimeLabel(timestampUtc, culture),
                _ => timestampUtc.ToLocalTime().ToString("dd MMM", culture),
            };
        }

        private static string FormatAllTimeLabel(DateTime timestampUtc, CultureInfo culture)
        {
            var local = timestampUtc.ToLocalTime();
            return local.Year == DateTime.Now.Year
                ? local.ToString("dd MMM", culture)
                : local.ToString("MMM yy", culture);
        }

        private async Task TryWriteImmediateSnapshotAsync(int portfolioId)
        {
            try
            {
                var portfolio = await _portfolioRepository.GetByIdAsync(portfolioId);
                if (portfolio is null)
                {
                    return;
                }

                var assets = await _assetRepository.GetByPortfolioIdAsync(portfolioId);
                var capturedAtUtc = DateTime.UtcNow;
                var usdTry = ResolveUsdTryRate();
                var (totalTry, totalUsd) = CalculateSnapshotTotals(assets, usdTry);

                var snapshot = new PortfolioValueSnapshot
                {
                    PortfolioId = portfolioId,
                    CapturedAtUtc = capturedAtUtc,
                    TotalValueTry = Math.Round(totalTry, 8),
                    TotalValueUsd = Math.Round(totalUsd, 8),
                    UsdTryRate = usdTry > 0m ? usdTry : null,
                };

                await _portfolioValueSnapshotRepository.AddBatchAsync(new[] { snapshot });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write immediate portfolio snapshot for portfolio {PortfolioId}.", portfolioId);
            }
        }

        private decimal ResolveUsdTryRate()
        {
            var forex = _marketDataCache.GetForex("USDTRY");
            if (forex is not null && forex.Rate > 0m)
            {
                return forex.Rate;
            }

            return _marketDataCache.GetUsdTry();
        }

        private (decimal totalTry, decimal totalUsd) CalculateSnapshotTotals(IEnumerable<PortfolioAsset> assets, decimal usdTry)
        {
            decimal totalTry = 0m;
            decimal totalUsd = 0m;

            foreach (var asset in assets)
            {
                var unitPrice = ResolveSnapshotUnitPrice(asset);
                var positionValue = asset.Quantity * unitPrice;

                totalTry += ConvertSnapshotCurrency(positionValue, asset.Currency, "TRY", usdTry);
                totalUsd += ConvertSnapshotCurrency(positionValue, asset.Currency, "USD", usdTry);
            }

            return (totalTry, totalUsd);
        }

        private decimal ResolveSnapshotUnitPrice(PortfolioAsset asset)
        {
            switch (asset.AssetType)
            {
                case AssetType.Crypto:
                {
                    var symbol = asset.Symbol.ToUpperInvariant() + "USDT";
                    var crypto = _marketDataCache.GetCrypto(symbol);
                    if (crypto is not null)
                    {
                        var assetCurrency = NormalizeCurrency(asset.Currency);
                        if (assetCurrency == "TRY" && crypto.PriceTry > 0m)
                        {
                            return crypto.PriceTry;
                        }

                        if (crypto.PriceUsdt > 0m)
                        {
                            return crypto.PriceUsdt;
                        }
                    }

                    break;
                }
                case AssetType.BIST:
                {
                    var ticker = asset.Symbol.ToUpperInvariant();
                    if (!ticker.EndsWith(".IS", StringComparison.OrdinalIgnoreCase))
                    {
                        ticker += ".IS";
                    }

                    var stock = _marketDataCache.GetStock(ticker);
                    if (stock is not null && stock.Price > 0m)
                    {
                        return stock.Price;
                    }

                    break;
                }
                case AssetType.PreciousMetal:
                {
                    var gold = _marketDataCache.GetGold(asset.Symbol);
                    if (gold is not null)
                    {
                        var assetCurrency = NormalizeCurrency(asset.Currency);
                        if (assetCurrency == "TRY" && gold.GramTry > 0m)
                        {
                            return gold.GramTry;
                        }

                        if (gold.GramUsd > 0m)
                        {
                            return gold.GramUsd;
                        }
                    }

                    break;
                }
            }

            return asset.CurrentValue ?? asset.AverageCost;
        }

        private static decimal ConvertSnapshotCurrency(decimal amount, string fromCurrency, string targetCurrency, decimal usdTry)
        {
            var normalizedFrom = NormalizeCurrency(fromCurrency);
            if (normalizedFrom == targetCurrency)
            {
                return amount;
            }

            if (usdTry <= 0m)
            {
                return amount;
            }

            if (normalizedFrom == "USD" && targetCurrency == "TRY")
            {
                return amount * usdTry;
            }

            if (normalizedFrom == "TRY" && targetCurrency == "USD")
            {
                return amount / usdTry;
            }

            return amount;
        }

        private static string NormalizeCurrency(string? currency)
        {
            if (string.IsNullOrWhiteSpace(currency))
            {
                return "TRY";
            }

            return currency.Trim().ToUpperInvariant();
        }

        // ── Mapping Helpers (Manual) ─────────────────────────────────────────

        private PortfolioDto MapToDto(Portfolio p)
        {
            return new PortfolioDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ParentPortfolioId = p.ParentPortfolioId,
                CreatedAtUtc = p.CreatedAtUtc,
                IsHiddenFromEconomists = p.IsHiddenFromEconomists,
                Assets = p.Assets?.Select(MapAssetToDto).ToList() ?? new List<PortfolioAssetDto>(),
                SubPortfolios = p.SubPortfolios?.Select(MapToDto).ToList() ?? new List<PortfolioDto>()
            };
        }

        private static PortfolioTransactionDto MapTransactionToDto(PortfolioTransaction t)
        {
            var note = t.Type == TransactionType.Buy ? t.Notes : null;

            return new PortfolioTransactionDto
            {
                Id = t.Id,
                PortfolioId = t.PortfolioId,
                Symbol = t.Symbol,
                AssetName = t.AssetName,
                AssetType = t.AssetType,
                Type = t.Type,
                Quantity = t.Quantity,
                Price = t.Price,
                Currency = t.Currency,
                Fees = t.Fees,
                Notes = note,
                ExecutedAtUtc = t.ExecutedAtUtc,
                CreatedAtUtc = t.CreatedAtUtc
            };
        }

        private PortfolioAssetDto MapAssetToDto(PortfolioAsset a)
        {
            var (livePrice, livePriceUpdatedAt) = ResolveCurrentValue(a);

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
                CurrentValue = livePrice ?? a.CurrentValue,
                CurrentValueUpdatedAtUtc = livePrice.HasValue ? livePriceUpdatedAt : a.CurrentValueUpdatedAtUtc,
                AcquiredAtUtc = a.AcquiredAtUtc,
                Notes = a.Notes
            };
        }

        private (decimal? price, DateTime? updatedAt) ResolveCurrentValue(PortfolioAsset asset)
        {
            try
            {
                switch (asset.AssetType)
                {
                    case AssetType.Crypto:
                        var cryptoSymbol = asset.Symbol.ToUpperInvariant() + "USDT";
                        var crypto = _marketDataCache.GetCrypto(cryptoSymbol);
                        if (crypto is not null && crypto.PriceUsdt > 0m)
                            return (crypto.PriceUsdt, crypto.UpdatedAt);
                        break;

                    case AssetType.BIST:
                        var bistTicker = asset.Symbol.ToUpperInvariant();
                        if (!bistTicker.EndsWith(".IS", StringComparison.OrdinalIgnoreCase))
                            bistTicker += ".IS";
                        var stock = _marketDataCache.GetStock(bistTicker);
                        if (stock is not null && stock.Price > 0m)
                            return (stock.Price, stock.UpdatedAt);
                        break;

                    case AssetType.PreciousMetal:
                        var gold = _marketDataCache.GetGold(asset.Symbol);
                        if (gold is not null && gold.GramUsd > 0m)
                            return (gold.GramUsd, gold.UpdatedAt);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve live price for asset {Symbol}.", asset.Symbol);
            }

            return (null, null);
        }
    }
}
