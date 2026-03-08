using CleanArchitecture.Core.DTOs.Account;
using CleanArchitecture.Core.Enums;
using CleanArchitecture.Core.Exceptions;
using CleanArchitecture.Core.Interfaces;
using CleanArchitecture.Core.Settings;
using CleanArchitecture.Infrastructure.Helpers;
using CleanArchitecture.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace CleanArchitecture.Infrastructure.Services
{
    public class AccountService : IAccountService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly JWTSettings _jwtSettings;
        public AccountService(UserManager<ApplicationUser> userManager,
            IOptions<JWTSettings> jwtSettings,
            SignInManager<ApplicationUser> signInManager)
        {
            _userManager = userManager;
            _jwtSettings = jwtSettings.Value;
            _signInManager = signInManager;
        }

        public async Task<AuthenticationResponse> AuthenticateAsync(AuthenticationRequest request, string ipAddress)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                throw new ApiException($"No Accounts Registered with {request.Email}.");
            }
            var result = await _signInManager.PasswordSignInAsync(user.UserName, request.Password, false, lockoutOnFailure: false);
            if (!result.Succeeded)
            {
                throw new ApiException($"Invalid Credentials for '{request.Email}'.");
            }
            if (!user.EmailConfirmed)
            {
                throw new ApiException($"Account Not Confirmed for '{request.Email}'.");
            }
            JwtSecurityToken jwtSecurityToken = await GenerateJWToken(user);
            AuthenticationResponse response = new AuthenticationResponse();
            response.Id = user.Id;
            response.JWToken = new JwtSecurityTokenHandler().WriteToken(jwtSecurityToken);
            response.FirstName = user.FirstName;
            response.LastName = user.LastName;
            response.Email = user.Email;
            response.UserName = user.UserName;
            var rolesList = await _userManager.GetRolesAsync(user).ConfigureAwait(false);
            response.Roles = rolesList.ToList();
            response.IsVerified = user.EmailConfirmed;
            return response;
        }

        public async Task<string> RegisterAsync(RegisterRequest request, string origin)
        {
            var userName = await GenerateUniqueUserNameAsync(request.UserName, request.Email);
            var userWithSameUserName = await _userManager.FindByNameAsync(userName);
            if (userWithSameUserName != null)
            {
                throw new ApiException($"Username '{userName}' is already taken.");
            }

            var roleName = ResolveRegistrationRole(request.Role);
            var user = new ApplicationUser
            {
                Email = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = userName,
                EmailConfirmed = true
            };
            var userWithSameEmail = await _userManager.FindByEmailAsync(request.Email);
            if (userWithSameEmail == null)
            {
                var result = await _userManager.CreateAsync(user, request.Password);
                if (result.Succeeded)
                {
                    var addToRoleResult = await _userManager.AddToRoleAsync(user, roleName);
                    if (!addToRoleResult.Succeeded)
                    {
                        throw new ApiException(string.Join(" ", addToRoleResult.Errors.Select(error => error.Description)));
                    }

                    return "User registered successfully. You can now sign in.";
                }
                else
                {
                    throw new ApiException(string.Join(" ", result.Errors.Select(error => error.Description)));
                }
            }
            else
            {
                throw new ApiException($"Email {request.Email } is already registered.");
            }
        }

        private static string ResolveRegistrationRole(string requestedRole)
        {
            if (string.IsNullOrWhiteSpace(requestedRole))
            {
                throw new ApiException("Role is required.");
            }

            return requestedRole.Trim().ToUpperInvariant() switch
            {
                "USER" => Roles.User.ToString(),
                "ECONOMIST" => Roles.Economist.ToString(),
                "ADMIN" => throw new ApiException("Admin role cannot be assigned during self-registration."),
                _ => throw new ApiException($"Unsupported role '{requestedRole}'.")
            };
        }

        private async Task<string> GenerateUniqueUserNameAsync(string requestedUserName, string email)
        {
            var baseUserNameSource = string.IsNullOrWhiteSpace(requestedUserName)
                ? email?.Split('@').FirstOrDefault()
                : requestedUserName;

            var sanitizedBaseUserName = new string((baseUserNameSource ?? string.Empty)
                .Trim()
                .Where(char.IsLetterOrDigit)
                .ToArray());

            if (string.IsNullOrWhiteSpace(sanitizedBaseUserName))
            {
                throw new ApiException("A valid username could not be generated from the provided data.");
            }

            var candidate = sanitizedBaseUserName;
            var suffix = 1;

            while (await _userManager.FindByNameAsync(candidate) != null)
            {
                candidate = $"{sanitizedBaseUserName}{suffix}";
                suffix++;
            }

            return candidate;
        }

        private async Task<JwtSecurityToken> GenerateJWToken(ApplicationUser user)
        {
            var userClaims = await _userManager.GetClaimsAsync(user);
            var roles = await _userManager.GetRolesAsync(user);

            var roleClaims = new List<Claim>();

            for (int i = 0; i < roles.Count; i++)
            {
                roleClaims.Add(new Claim("roles", roles[i]));
            }

            string ipAddress = IpHelper.GetIpAddress();

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("uid", user.Id),
                new Claim("ip", ipAddress)
            }
            .Union(userClaims)
            .Union(roleClaims);

            var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            var signingCredentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256);

            var jwtSecurityToken = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtSettings.DurationInMinutes),
                signingCredentials: signingCredentials);
            return jwtSecurityToken;
        }
    }
}
