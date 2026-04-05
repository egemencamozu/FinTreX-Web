using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Contexts;
using FinTreX.Infrastructure.Models;
using FinTreX.Infrastructure.Repositories;
using FinTreX.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Text;

namespace FinTreX.Infrastructure
{
    public static class ServiceRegistration
    {
        public static void AddPersistenceInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "ConnectionStrings:DefaultConnection is missing. Configure Azure SQL connection string with 'Authentication=Active Directory Default'.");
            }

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(
                    connectionString,
                    sqlOptions =>
                    {
                        sqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                        // Azure SQL resilience — retry on transient failures
                        sqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(10),
                            errorNumbersToAdd: null);
                    }));
            services.AddIdentity<ApplicationUser, IdentityRole>().AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders();

            #region Repositories
            services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
            services.AddScoped<IPortfolioRepository, PortfolioRepository>();
            services.AddScoped<IPortfolioAssetRepository, PortfolioAssetRepository>();
            services.AddScoped<IConsultancyTaskRepository, ConsultancyTaskRepository>();
            services.AddScoped<IEconomistClientRepository, EconomistClientRepository>();
            services.AddScoped<IUserSubscriptionRepository, UserSubscriptionRepository>();
            services.AddScoped<IPreAnalysisReportRepository, PreAnalysisReportRepository>();
            #endregion

            #region Services
            services.AddTransient<IAccountService, AccountService>();
            services.AddTransient<IUserManagementService, UserManagementService>();
            services.AddTransient<IEmailService, SmtpEmailService>();
            #endregion

            #region PAA — Python CrewAI microservice client
            var paaBaseUrl = configuration.GetValue<string>("PaaService:BaseUrl") ?? "http://localhost:8500";
            services.AddHttpClient<IPreAnalysisService, PreAnalysisService>(client =>
            {
                client.BaseAddress = new Uri(paaBaseUrl);
                client.Timeout = TimeSpan.FromSeconds(120); // CrewAI birkaç saniye sürebilir
            });
            #endregion
            services.Configure<JWTSettings>(configuration.GetSection("JWTSettings"));
            services.Configure<EmailSettings>(configuration.GetSection("EmailSettings"));
            services.Configure<PasswordResetSettings>(configuration.GetSection("PasswordResetSettings"));

            var jwtKey = configuration["JWTSettings:Key"];
            if (string.IsNullOrWhiteSpace(jwtKey))
            {
                throw new InvalidOperationException(
                    "JWTSettings:Key is missing. Configure it via User Secrets or environment variables. " +
                    "Example (PowerShell): dotnet user-secrets set \"JWTSettings:Key\" \"<strong-random-key>\" in FinTreX.WebApi project.");
            }

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
                .AddJwtBearer(o =>
                {
                    o.RequireHttpsMetadata = false;
                    o.SaveToken = false;
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero,
                        ValidIssuer = configuration["JWTSettings:Issuer"],
                        ValidAudience = configuration["JWTSettings:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                        RoleClaimType = System.Security.Claims.ClaimTypes.Role
                    };
                    o.Events = new JwtBearerEvents()
                    {
                        OnAuthenticationFailed = c =>
                        {
                            c.NoResult();
                            c.Response.StatusCode = 401;
                            c.Response.ContentType = "application/json";
                            return c.Response.WriteAsync("{\"error\": \"" + c.Exception.Message + "\"}");
                        },
                        OnChallenge = context =>
                        {
                            context.HandleResponse();
                            context.Response.StatusCode = 401;
                            context.Response.ContentType = "application/json";
                            var result = "{\"error\": \"You are not Authorized\"}";
                            return context.Response.WriteAsync(result);
                        },
                        OnForbidden = context =>
                        {
                            context.Response.StatusCode = 403;
                            context.Response.ContentType = "application/json";
                            var result = "{\"error\": \"You are not authorized to access this resource\"}";
                            return context.Response.WriteAsync(result);
                        },
                    };
                });
        }
    }
}
