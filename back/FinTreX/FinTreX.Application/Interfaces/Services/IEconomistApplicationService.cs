using FinTreX.Core.DTOs.Economist;
using FinTreX.Core.Enums;
using System.Threading.Tasks;

namespace FinTreX.Core.Interfaces.Services
{
    public interface IEconomistApplicationService
    {
        Task<EconomistApplicationDto> SubmitAsync(SubmitEconomistApplicationRequest request);

        Task<EconomistApplicationDto?> GetMyLatestAsync();
        Task<PagedEconomistApplicationsResult> AdminListAsync(EconomistStatus? status, int page, int pageSize);
        Task<EconomistApplicationDto> AdminGetDetailAsync(int id);
        Task<EconomistApplicationDto> AdminReviewAsync(int id, AdminReviewApplicationRequest request);

    }
}
