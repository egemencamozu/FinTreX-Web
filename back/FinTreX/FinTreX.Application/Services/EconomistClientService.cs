using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
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
    /// Service for managing economist assignments to clients.
    /// BUSINESS RULE: Enforces subscription-based limits on economist count.
    /// </summary>
    public class EconomistClientService : IEconomistClientService
    {
        private readonly IEconomistClientRepository _assignmentRepository;
        private readonly IUserSubscriptionRepository _subscriptionRepository;
        private readonly IGenericRepository<SubscriptionPlan> _planRepository;
        private readonly ICurrentUserService _currentUserService;

        public EconomistClientService(
            IEconomistClientRepository assignmentRepository,
            IUserSubscriptionRepository subscriptionRepository,
            IGenericRepository<SubscriptionPlan> planRepository,
            ICurrentUserService currentUserService)
        {
            _assignmentRepository = assignmentRepository;
            _subscriptionRepository = subscriptionRepository;
            _planRepository = planRepository;
            _currentUserService = currentUserService;
        }

        public async Task<IReadOnlyList<EconomistClientDto>> GetMyEconomistsAsync()
        {
            var assignments = await _assignmentRepository.GetEconomistsByClientIdAsync(_currentUserService.UserId);
            return assignments.Select(MapToDto).ToList().AsReadOnly();
        }

        public async Task<IReadOnlyList<EconomistClientDto>> GetMyClientsAsync()
        {
            if (!_currentUserService.IsEconomist) throw new ForbiddenException("Only economists can view their clients.");
            var assignments = await _assignmentRepository.GetClientsByEconomistIdAsync(_currentUserService.UserId);
            return assignments.Select(MapToDto).ToList().AsReadOnly();
        }

        public async Task<EconomistClientDto> AssignEconomistAsync(string economistId, string notes = null)
        {
            // 1. Get user's active subscription — auto-assign Default plan if missing
            var subscription = await _subscriptionRepository.GetWithPlanAsync(_currentUserService.UserId);
            if (subscription == null || subscription.SubscriptionPlan == null)
            {
                var allPlans = await _planRepository.GetAllAsync();
                var defaultPlan = allPlans.FirstOrDefault(p => p.Tier == SubscriptionTier.Default && p.IsActive);
                if (defaultPlan == null)
                    throw new ApiException("No active subscription plan found. Please contact support.");

                subscription = new UserSubscription
                {
                    ApplicationUserId = _currentUserService.UserId,
                    SubscriptionPlanId = defaultPlan.Id,
                    SubscriptionPlan = defaultPlan,
                    Status = SubscriptionStatus.Active,
                    StartedAtUtc = DateTime.UtcNow,
                };
                await _subscriptionRepository.AddAsync(subscription);
            }

            // 2. Check current active economist count
            int activeCount = await _assignmentRepository.GetActiveEconomistCountAsync(_currentUserService.UserId);

            // 3. ENFORCE LIMITS
            if (activeCount >= subscription.SubscriptionPlan.MaxEconomists)
            {
                throw new ApiException($"Subscription limit reached. Your current plan allows only {subscription.SubscriptionPlan.MaxEconomists} economist(s).");
            }

            // 4. Check if already assigned
            bool exists = await _assignmentRepository.IsClientAssignedAsync(economistId, _currentUserService.UserId);
            if (exists) throw new ApiException("This economist is already assigned to you.");

            // 5. Create assignment
            var assignment = new EconomistClient
            {
                ClientId = _currentUserService.UserId,
                EconomistId = economistId,
                AssignedAtUtc = DateTime.UtcNow,
                IsActive = true,
                Notes = notes
            };

            await _assignmentRepository.AddAsync(assignment);
            return MapToDto(assignment);
        }

        public async Task<bool> RemoveEconomistAsync(int assignmentId)
        {
            var assignment = await _assignmentRepository.GetByIdAsync(assignmentId);
            if (assignment == null) return false;

            // Check if user is standard, if so, check if they can change economists
            if (!_currentUserService.IsAdmin)
            {
                if (assignment.ClientId == _currentUserService.UserId)
                {
                    var subscription = await _subscriptionRepository.GetWithPlanAsync(_currentUserService.UserId);
                    if (!subscription.SubscriptionPlan.CanChangeEconomist)
                        throw new ForbiddenException("Your current plan does not allow changing economists.");
                }
                else if (assignment.EconomistId != _currentUserService.UserId)
                {
                    throw new ForbiddenException("Not authorized to remove this assignment.");
                }
            }

            assignment.IsActive = false;
            await _assignmentRepository.UpdateAsync(assignment);
            return true;
        }

        private static EconomistClientDto MapToDto(EconomistClient a)
        {
            return new EconomistClientDto
            {
                Id = a.Id,
                EconomistId = a.EconomistId,
                ClientId = a.ClientId,
                AssignedAtUtc = a.AssignedAtUtc,
                IsActive = a.IsActive,
                Notes = a.Notes
            };
        }
    }
}
