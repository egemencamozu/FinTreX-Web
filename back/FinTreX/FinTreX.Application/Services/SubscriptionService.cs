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
        private readonly IStripePaymentService _stripePaymentService;

        public SubscriptionService(
            IUserSubscriptionRepository subRepository,
            IGenericRepository<SubscriptionPlan> planRepository,
            ICurrentUserService currentUserService,
            IStripePaymentService stripePaymentService)
        {
            _subRepository = subRepository;
            _planRepository = planRepository;
            _currentUserService = currentUserService;
            _stripePaymentService = stripePaymentService;
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

            // Paid plans MUST go through Stripe checkout — block any direct DB upgrade.
            if (plan.Tier != SubscriptionTier.Default)
            {
                throw new InvalidOperationException("Paid plan upgrades must go through Stripe checkout.");
            }

            var sub = await _subRepository.GetWithPlanAsync(_currentUserService.UserId);
            if (sub == null)
            {
                sub = new UserSubscription { ApplicationUserId = _currentUserService.UserId };
                await _subRepository.AddAsync(sub);
            }

            // Prevent downgrade or same-tier selection
            if (sub.SubscriptionPlan != null && sub.Status == SubscriptionStatus.Active
                && plan.Tier <= sub.SubscriptionPlan.Tier)
            {
                throw new InvalidOperationException("Alt seviye veya aynı seviye bir plana geçiş yapılamaz.");
            }

            // Cancel active Stripe subscription before downgrading to free tier.
            if (!string.IsNullOrEmpty(sub.StripeSubscriptionId))
            {
                await _stripePaymentService.CancelStripeSubscriptionAsync(atPeriodEnd: false);
                sub.StripeSubscriptionId = null;
            }

            // Downgrade to free tier — clear period and unlink any Stripe subscription bookkeeping.
            sub.SubscriptionPlanId = planId;
            sub.Status = SubscriptionStatus.Active;
            sub.StartedAtUtc = DateTime.UtcNow;
            sub.CurrentPeriodEndUtc = null;
            sub.CancelledAtUtc = null;
            sub.CancelAtPeriodEnd = false;
            sub.BillingPeriod = "monthly";

            await _subRepository.UpdateAsync(sub);

            return await GetMySubscriptionAsync();
        }

        public async Task<bool> CancelSubscriptionAsync()
        {
            var sub = await _subRepository.GetByUserIdAsync(_currentUserService.UserId);
            if (sub == null) return false;

            // If this user has a live Stripe subscription, delegate to Stripe.
            // DB will be updated via the customer.subscription.updated webhook.
            if (!string.IsNullOrEmpty(sub.StripeSubscriptionId))
            {
                await _stripePaymentService.CancelStripeSubscriptionAsync(atPeriodEnd: true);
                return true;
            }

            // Local-only subscription (no Stripe link) — cancel directly.
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

            if (dto.StripeProductId != null)
                plan.StripeProductId = string.IsNullOrWhiteSpace(dto.StripeProductId) ? null : dto.StripeProductId.Trim();
            if (dto.StripeMonthlyPriceId != null)
                plan.StripeMonthlyPriceId = string.IsNullOrWhiteSpace(dto.StripeMonthlyPriceId) ? null : dto.StripeMonthlyPriceId.Trim();
            if (dto.StripeYearlyPriceId != null)
                plan.StripeYearlyPriceId = string.IsNullOrWhiteSpace(dto.StripeYearlyPriceId) ? null : dto.StripeYearlyPriceId.Trim();

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
                BillingPeriod = s.BillingPeriod ?? "monthly",
                Plan = MapPlanToDto(s.SubscriptionPlan),
                Status = s.Status,
                StartedAtUtc = s.StartedAtUtc,
                CurrentPeriodEndUtc = s.CurrentPeriodEndUtc,
                CancelledAtUtc = s.CancelledAtUtc,
                CancelAtPeriodEnd = s.CancelAtPeriodEnd
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
                StripeProductId = p.StripeProductId,
                StripeMonthlyPriceId = p.StripeMonthlyPriceId,
                StripeYearlyPriceId = p.StripeYearlyPriceId,
                Features = features
            };
        }
    }
}
