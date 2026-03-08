using CleanArchitecture.Core.DTOs.Account;
using System.Threading.Tasks;

namespace CleanArchitecture.Core.Interfaces
{
    public interface IAccountService
    {
        Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress);
        Task<string> RegisterAsync(RegisterRequest request, string origin);
    }
}
