using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
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
        private readonly IAlertsBroadcaster _broadcaster;
        private readonly ILogger<EconomistClientService> _logger;

        public EconomistClientService(
            IEconomistClientRepository assignmentRepository,
            IUserSubscriptionRepository subscriptionRepository,
            IGenericRepository<SubscriptionPlan> planRepository,
            ICurrentUserService currentUserService,
            IAlertsBroadcaster broadcaster,
            ILogger<EconomistClientService> logger)
        {
            _assignmentRepository = assignmentRepository;
            _subscriptionRepository = subscriptionRepository;
            _planRepository = planRepository;
            _currentUserService = currentUserService;
            _broadcaster = broadcaster;
            _logger = logger;
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

        public async Task<IReadOnlyList<EconomistClientDto>> AdminGetClientEconomistsAsync(string clientId)
        {
            if (!_currentUserService.IsAdmin) throw new ForbiddenException("Only admins can view client economist assignments.");
            if (string.IsNullOrWhiteSpace(clientId)) throw new ApiException("Client id is required.");

            var assignments = await _assignmentRepository.GetEconomistsByClientIdAsync(clientId);
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

            // 4. Check if already assigned or previously assigned
            var existingAssignment = await _assignmentRepository.GetAssignmentAsync(economistId, _currentUserService.UserId);
            if (existingAssignment != null)
            {
                if (existingAssignment.IsActive)
                {
                    throw new ApiException("This economist is already assigned to you.");
                }

                // Reactivate previously removed assignment
                existingAssignment.IsActive = true;
                existingAssignment.AssignedAtUtc = DateTime.UtcNow;
                existingAssignment.Notes = notes;

                await _assignmentRepository.UpdateAsync(existingAssignment);
                await PushAssignmentNotificationAsync(existingAssignment);
                return MapToDto(existingAssignment);
            }

            // 5. Create new assignment
            var assignment = new EconomistClient
            {
                ClientId = _currentUserService.UserId,
                EconomistId = economistId,
                AssignedAtUtc = DateTime.UtcNow,
                IsActive = true,
                Notes = notes
            };

            await _assignmentRepository.AddAsync(assignment);
            await PushAssignmentNotificationAsync(assignment);
            return MapToDto(assignment);
        }

        public async Task<EconomistClientDto> AdminChangeAssignmentAsync(int assignmentId, string newEconomistId, string notes = null)
        {
            if (!_currentUserService.IsAdmin) throw new ForbiddenException("Only admins can change economist assignments.");
            if (string.IsNullOrWhiteSpace(newEconomistId)) throw new ApiException("New economist is required.");

            var current = await _assignmentRepository.GetByIdAsync(assignmentId);
            if (current == null) throw new ApiException("Assignment not found.");
            if (!current.IsActive) throw new ApiException("Assignment is already inactive.");
            if (current.EconomistId == newEconomistId) throw new ApiException("This economist is already assigned.");

            var previousEconomistId = current.EconomistId;
            var existingTarget = await _assignmentRepository.GetAssignmentAsync(newEconomistId, current.ClientId);
            if (existingTarget != null && existingTarget.IsActive)
            {
                throw new ApiException("Selected economist is already assigned to this client.");
            }

            current.IsActive = false;
            await _assignmentRepository.UpdateAsync(current);

            EconomistClient nextAssignment;
            if (existingTarget != null)
            {
                existingTarget.IsActive = true;
                existingTarget.AssignedAtUtc = DateTime.UtcNow;
                existingTarget.Notes = null;
                await _assignmentRepository.UpdateAsync(existingTarget);
                nextAssignment = existingTarget;
            }
            else
            {
                nextAssignment = new EconomistClient
                {
                    ClientId = current.ClientId,
                    EconomistId = newEconomistId,
                    AssignedAtUtc = DateTime.UtcNow,
                    IsActive = true,
                    Notes = null
                };
                await _assignmentRepository.AddAsync(nextAssignment);
            }

            await PushAssignmentChangedNotificationAsync(nextAssignment, previousEconomistId, "Reassigned");
            return MapToDto(nextAssignment);
        }

        public async Task<EconomistClientDto> AdminRemoveAssignmentAsync(int assignmentId, string notes = null)
        {
            if (!_currentUserService.IsAdmin) throw new ForbiddenException("Only admins can remove economist assignments.");

            var assignment = await _assignmentRepository.GetByIdAsync(assignmentId);
            if (assignment == null) throw new ApiException("Assignment not found.");
            if (!assignment.IsActive) throw new ApiException("Assignment is already inactive.");

            assignment.IsActive = false;
            await _assignmentRepository.UpdateAsync(assignment);

            await PushAssignmentChangedNotificationAsync(assignment, assignment.EconomistId, "Removed");
            return MapToDto(assignment);
        }

        private async Task PushAssignmentNotificationAsync(EconomistClient assignment)
        {
            try
            {
                await _broadcaster.PushEconomistClientAssignedAsync(assignment.EconomistId, new EconomistClientAssignedEventDto
                {
                    AssignmentId = assignment.Id,
                    ClientId = assignment.ClientId,
                    ClientName = _currentUserService.Email ?? assignment.ClientId
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistClientAssigned for assignment {AssignmentId}", assignment.Id);
            }
        }

        private async Task PushAssignmentChangedNotificationAsync(EconomistClient assignment, string previousEconomistId, string action)
        {
            var payload = new EconomistClientChangedEventDto
            {
                AssignmentId = assignment.Id,
                Action = action,
                ClientId = assignment.ClientId,
                ClientName = assignment.ClientId,
                EconomistId = assignment.IsActive ? assignment.EconomistId : null,
                PreviousEconomistId = previousEconomistId
            };

            try
            {
                await _broadcaster.PushEconomistClientChangedAsync(assignment.ClientId, payload);
                await _broadcaster.PushEconomistClientChangedAsync(previousEconomistId, payload);
                if (assignment.IsActive && assignment.EconomistId != previousEconomistId)
                {
                    await _broadcaster.PushEconomistClientChangedAsync(assignment.EconomistId, payload);
                }
                await _broadcaster.PushEconomistClientChangedForAdminsAsync(payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistClientChanged for assignment {AssignmentId}", assignment.Id);
            }
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
