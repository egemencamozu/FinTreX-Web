using FinTreX.Core.Enums;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using System;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Seeds
{
    public static class DefaultRoles
    {
        public static async Task SeedAsync(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager)
        {
            foreach (var role in Enum.GetNames(typeof(Roles)))
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new IdentityRole(role));
                }
            }
        }
    }
}
