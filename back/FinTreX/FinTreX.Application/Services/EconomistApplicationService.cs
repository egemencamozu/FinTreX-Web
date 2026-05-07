using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Exceptions;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.Core.Services
{
    public class EconomistApplicationService : IEconomistApplicationService
    {
        private readonly IEconomistApplicationRepository _applicationRepository;
        private readonly IFileStorageService _fileStorage;
        private readonly ICurrentUserService _currentUser;
        private readonly IUserManagementService _userManagementService;
        private readonly IAlertsBroadcaster _broadcaster;
        private readonly ILogger<EconomistApplicationService> _logger;

        public EconomistApplicationService(
            IEconomistApplicationRepository applicationRepository,
            IFileStorageService fileStorage,
            ICurrentUserService currentUser,
            IUserManagementService userManagementService,
            IAlertsBroadcaster broadcaster,
            ILogger<EconomistApplicationService> logger)
        {
            _applicationRepository = applicationRepository;
            _fileStorage = fileStorage;
            _currentUser = currentUser;
            _userManagementService = userManagementService;
            _broadcaster = broadcaster;
            _logger = logger;
        }

        public async Task<EconomistApplicationDto> SubmitAsync(SubmitEconomistApplicationRequest request)
        {
            if (!_currentUser.IsEconomist)
                throw new ForbiddenException("Only economists can submit applications.");

            var existing = await _applicationRepository.GetLatestByUserIdAsync(_currentUser.UserId);
            if (existing != null && existing.Status == EconomistStatus.Pending)
                throw new ApiException("You already have a pending application. Please wait for admin review.");
            if (existing != null && existing.Status == EconomistStatus.Approved)
                throw new ApiException("Your application has already been approved.");

            var application = new EconomistApplication
            {
                ApplicantUserId = _currentUser.UserId,
                FullName = request.FullName,
                Phone = request.Phone,
                Biography = request.Biography,
                YearsOfExperience = request.YearsOfExperience,
                Education = request.Education,
                CurrentTitle = request.CurrentTitle,
                Institution = request.Institution,
                ExpertiseAreas = request.ExpertiseAreas,
                LicensesAndCertificates = request.LicensesAndCertificates,
                Links = request.Links.Select(l => new EconomistApplicationLink
                {
                    Platform = l.Platform,
                    Url = l.Url
                }).ToList(),
                Status = EconomistStatus.Pending,
                SubmittedAtUtc = DateTime.UtcNow
            };

            await _applicationRepository.AddAsync(application);
            await _userManagementService.UpdateEconomistStatusAsync(_currentUser.UserId, EconomistStatus.Pending);

            try
            {
                await _broadcaster.PushEconomistApplicationSubmittedToAdminsAsync(new EconomistApplicationSubmittedEventDto
                {
                    ApplicationId = application.Id,
                    ApplicantUserId = _currentUser.UserId,
                    ApplicantName = request.FullName
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistApplicationSubmitted notification for application {Id}", application.Id);
            }

            return MapToDto(application);
        }

        public async Task<EconomistApplicationDto?> GetMyLatestAsync()
        {
            if (!_currentUser.IsEconomist)
                throw new ForbiddenException("Only economists can view their applications.");

            var application = await _applicationRepository.GetLatestByUserIdAsync(_currentUser.UserId);
            return application == null ? null : MapToDto(application);
        }

        public async Task<PagedEconomistApplicationsResult> AdminListAsync(EconomistStatus? status, int page, int pageSize)
        {
            if (!_currentUser.IsAdmin)
                throw new ForbiddenException("Only admins can list applications.");

            var skip = (page - 1) * pageSize;
            var (items, total) = await _applicationRepository.GetPagedByStatusAsync(status, skip, pageSize);

            return new PagedEconomistApplicationsResult
            {
                Items = items.Select(MapToDto).ToList(),
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<EconomistApplicationDto> AdminGetDetailAsync(int id)
        {
            if (!_currentUser.IsAdmin)
                throw new ForbiddenException("Only admins can view application details.");

            var application = await _applicationRepository.GetByIdAsync(id);
            if (application == null)
                throw new ApiException("Application not found.");

            return MapToDto(application);
        }

        public async Task<EconomistApplicationDto> AdminReviewAsync(int id, AdminReviewApplicationRequest request)
        {
            if (!_currentUser.IsAdmin)
                throw new ForbiddenException("Only admins can review applications.");

            var application = await _applicationRepository.GetByIdAsync(id);
            if (application == null)
                throw new ApiException("Application not found.");
            if (application.Status != EconomistStatus.Pending)
                throw new ApiException("Only pending applications can be reviewed.");

            var isApprove = string.Equals(request.Decision, "Approve", StringComparison.OrdinalIgnoreCase);
            var isReject = string.Equals(request.Decision, "Reject", StringComparison.OrdinalIgnoreCase);

            if (!isApprove && !isReject)
                throw new ApiException("Decision must be 'Approve' or 'Reject'.");
            if (isReject && string.IsNullOrWhiteSpace(request.Note))
                throw new ApiException("A rejection note is required.");

            var newStatus = isApprove ? EconomistStatus.Approved : EconomistStatus.Rejected;

            application.Status = newStatus;
            application.AdminDecisionNote = request.Note;
            application.ReviewedByAdminId = _currentUser.UserId;
            application.ReviewedAtUtc = DateTime.UtcNow;

            await _applicationRepository.UpdateAsync(application);
            await _userManagementService.UpdateEconomistStatusAsync(application.ApplicantUserId, newStatus);

            try
            {
                await _broadcaster.PushEconomistApplicationDecisionAsync(application.ApplicantUserId, new EconomistApplicationDecisionEventDto
                {
                    ApplicationId = application.Id,
                    Decision = newStatus,
                    Note = request.Note
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to push EconomistApplicationDecision for application {Id}", application.Id);
            }

            return MapToDto(application);
        }

        private static EconomistApplicationDto MapToDto(EconomistApplication a) => new()
        {
            Id = a.Id,
            ApplicantUserId = a.ApplicantUserId,
            FullName = a.FullName,
            Phone = a.Phone,
            Biography = a.Biography,
            YearsOfExperience = a.YearsOfExperience,
            Education = a.Education,
            CurrentTitle = a.CurrentTitle,
            Institution = a.Institution,
            ExpertiseAreas = a.ExpertiseAreas,
            LicensesAndCertificates = a.LicensesAndCertificates,
            Links = a.Links?.Select(l => new EconomistApplicationLinkDto { Id = l.Id, Platform = l.Platform, Url = l.Url }).ToList() ?? new(),
            Status = a.Status,
            AdminDecisionNote = a.AdminDecisionNote,
            SubmittedAtUtc = a.SubmittedAtUtc,
            ReviewedAtUtc = a.ReviewedAtUtc
        };

    }
}
