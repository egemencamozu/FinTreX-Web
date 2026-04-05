using FinTreX.Core.DTOs.Subscription;
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

using System.Text.Json;

namespace FinTreX.Core.Services
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly IUserSubscriptionRepository _subRepository;
        private readonly IGenericRepository<SubscriptionPlan> _planRepository;
        private readonly ICurrentUserService _currentUserService;

        public SubscriptionService(
            IUserSubscriptionRepository subRepository,
            IGenericRepository<SubscriptionPlan> planRepository,
            ICurrentUserService currentUserService)
        {
            _subRepository = subRepository;
            _planRepository = planRepository;
            _currentUserService = currentUserService;
        }

        public async Task<IReadOnlyList<SubscriptionPlanDto>> GetPlansAsync(bool onlyActive = false)
        {
            var plans = await _planRepository.GetAllAsync();
            var query = plans.AsEnumerable();
            
            if (onlyActive)
            {
                query = query.Where(p => p.IsActive);
            }
            
            return query.Select(MapPlanToDto).ToList().AsReadOnly();
        }

        public async Task<UserSubscriptionDto> GetMySubscriptionAsync()
        {
            var sub = await _subRepository.GetWithPlanAsync(_currentUserService.UserId);
            if (sub == null) return null;

            return MapToDto(sub);
        }

        public async Task<UserSubscriptionDto> UpgradePlanAsync(int planId)
        {
            var plan = await _planRepository.GetByIdAsync(planId);
            if (plan == null) throw new KeyNotFoundException("Plan not found.");

            var sub = await _subRepository.GetByUserIdAsync(_currentUserService.UserId);
            if (sub == null)
            {
                sub = new UserSubscription { ApplicationUserId = _currentUserService.UserId };
                await _subRepository.AddAsync(sub);
            }
            
            sub.SubscriptionPlanId = planId;
            sub.Status = SubscriptionStatus.Active;
            sub.StartedAtUtc = DateTime.UtcNow;
            sub.CurrentPeriodEndUtc = DateTime.UtcNow.AddMonths(1);
            sub.CancelledAtUtc = null;

            await _subRepository.UpdateAsync(sub);
            
            // Re-fetch to get plan details
            return await GetMySubscriptionAsync();
        }

        public async Task<bool> CancelSubscriptionAsync()
        {
            var sub = await _subRepository.GetByUserIdAsync(_currentUserService.UserId);
            if (sub == null) return false;

            sub.Status = SubscriptionStatus.Cancelled;
            sub.CancelledAtUtc = DateTime.UtcNow;

            await _subRepository.UpdateAsync(sub);
            return true;
        }

        public async Task<SubscriptionPlanDto> UpdatePlanAsync(int planId, UpdateSubscriptionPlanDto dto)
        {
            var plan = await _planRepository.GetByIdAsync(planId);
            if (plan == null) throw new KeyNotFoundException("Subscription plan not found.");

            plan.DisplayName = dto.DisplayName;
            plan.Description = dto.Description;
            plan.MonthlyPriceTRY = dto.MonthlyPriceTRY;
            plan.YearlyPriceTRY = dto.YearlyPriceTRY;
            plan.MaxEconomists = dto.MaxEconomists;
            plan.CanChangeEconomist = dto.CanChangeEconomist;
            plan.HasPrioritySupport = dto.HasPrioritySupport;
            plan.IsActive = dto.IsActive;

            // Handle flexible features list (new object structure)
            plan.FeaturesJson = JsonSerializer.Serialize(dto.Features ?? new List<PlanFeatureDto>());

            await _planRepository.UpdateAsync(plan);

            return MapPlanToDto(plan);
        }

        private static UserSubscriptionDto MapToDto(UserSubscription s)
        {
            return new UserSubscriptionDto
            {
                Id = s.Id,
                Plan = MapPlanToDto(s.SubscriptionPlan),
                Status = s.Status,
                StartedAtUtc = s.StartedAtUtc,
                CurrentPeriodEndUtc = s.CurrentPeriodEndUtc,
                CancelledAtUtc = s.CancelledAtUtc
            };
        }

        private static SubscriptionPlanDto MapPlanToDto(SubscriptionPlan p)
        {
            if (p == null) return null;

            List<PlanFeatureDto> features = new();
            if (!string.IsNullOrEmpty(p.FeaturesJson))
            {
                try { features = JsonSerializer.Deserialize<List<PlanFeatureDto>>(p.FeaturesJson) ?? new(); } catch { /* ignore */ }
            }

            return new SubscriptionPlanDto
            {
                Id = p.Id,
                Tier = p.Tier,
                DisplayName = p.DisplayName,
                Description = p.Description,
                MonthlyPriceTRY = p.MonthlyPriceTRY,
                YearlyPriceTRY = p.YearlyPriceTRY,
                MaxEconomists = p.MaxEconomists,
                CanChangeEconomist = p.CanChangeEconomist,
                HasPrioritySupport = p.HasPrioritySupport,
                IsActive = p.IsActive,
                Features = features
            };
        }
    }
}
