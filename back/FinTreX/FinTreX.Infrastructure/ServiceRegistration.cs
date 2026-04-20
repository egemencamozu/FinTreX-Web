using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Contexts;
using FinTreX.Infrastructure.Models;
using FinTreX.Infrastructure.Repositories;
using FinTreX.Infrastructure.Services.MarketData.Routing;
using FinTreX.Infrastructure.Services.MarketData.Cache;
using FinTreX.Infrastructure.Services.MarketData.Decode;
using FinTreX.Infrastructure.Services.MarketData.Broadcast;
using FinTreX.Infrastructure.Services.MarketData.Handlers;
using FinTreX.Infrastructure.Services;
using FinTreX.Infrastructure.Services.MarketData.Session;
using FinTreX.Infrastructure.Services.MarketData.Symbols;
using FinTreX.Infrastructure.Services.MarketData;
using FinTreX.Infrastructure.Services.MarketData.WebSocket;
using FinTreX.Infrastructure.Configuration;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Text;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure
{
    public static class ServiceRegistration
    {
        public static void AddPersistenceInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = PostgresConnectionStringGuard.Validate(
                configuration.GetConnectionString("DefaultConnection"),
                "ConnectionStrings:DefaultConnection");

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(
                    connectionString,
                    npgsqlOptions =>
                    {
                        npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                        // PostgreSQL resilience — retry on transient failures
                        npgsqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(10),
                            errorCodesToAdd: null);
                    }));
            services.AddIdentity<ApplicationUser, IdentityRole>().AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders();

            #region Repositories
            services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
            services.AddScoped<IDailyCloseRepository, DailyCloseRepository>();
            services.AddScoped<ICryptoEnrichmentRepository, CryptoEnrichmentRepository>();
            services.AddScoped<IPortfolioRepository, PortfolioRepository>();
            services.AddScoped<IPortfolioAssetRepository, PortfolioAssetRepository>();
            services.AddScoped<IConsultancyTaskRepository, ConsultancyTaskRepository>();
            services.AddScoped<IEconomistClientRepository, EconomistClientRepository>();
            services.AddScoped<IUserSubscriptionRepository, UserSubscriptionRepository>();
            services.AddScoped<IPreAnalysisReportRepository, PreAnalysisReportRepository>();
            services.AddScoped<IChatRepository, ChatRepository>();
            services.AddScoped<IAiConversationRepository, AiConversationRepository>();
            #endregion

            #region Services
            services.AddTransient<IAccountService, AccountService>();
            services.AddTransient<IUserManagementService, UserManagementService>();
            services.AddTransient<IEmailService, SmtpEmailService>();
            services.AddTransient<IMailKitEmailService, MailKitEmailService>();
            services.AddScoped<IEmailVerificationService, EmailVerificationService>();
            services.AddScoped<IStripePaymentService, StripePaymentService>();
            #endregion

            #region PAA — Python CrewAI microservice client
            var paaBaseUrl = configuration.GetValue<string>("PaaService:BaseUrl") ?? "http://localhost:8500";
            services.AddHttpClient<IPreAnalysisService, PreAnalysisService>(client =>
            {
                client.BaseAddress = new Uri(paaBaseUrl);
                client.Timeout = TimeSpan.FromSeconds(120);
            });
            #endregion

            #region AI Assistant — Python LangGraph microservice client
            services.Configure<AiAssistantSettings>(configuration.GetSection("AiAssistant"));
            var aiSettings = configuration.GetSection("AiAssistant").Get<AiAssistantSettings>()
                ?? new AiAssistantSettings();

            services.AddHttpClient<IAiAssistantService, AiAssistantService>(client =>
            {
                client.BaseAddress = new Uri(aiSettings.ServiceUrl);
                client.Timeout = TimeSpan.FromSeconds(aiSettings.TimeoutSeconds);
            });
            #endregion

            services.AddHttpContextAccessor();
            services.Configure<JWTSettings>(configuration.GetSection("JWTSettings"));
            services.Configure<EmailSettings>(configuration.GetSection("EmailSettings"));
            services.Configure<PasswordResetSettings>(configuration.GetSection("PasswordResetSettings"));
            services.Configure<StripeSettings>(configuration.GetSection("Stripe"));

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
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) &&
                                (path.StartsWithSegments("/hubs/market") ||
                                 path.StartsWithSegments("/hubs/chat")))
                            {
                                context.Token = accessToken;
                            }
                            return Task.CompletedTask;
                        },
                        OnAuthenticationFailed = c =>
                        {
                            // Do not force a response here.
                            // For anonymous endpoints, invalid bearer should not convert a successful request to 401.
                            c.NoResult();
                            return Task.CompletedTask;
                        },
                        OnChallenge = context =>
                        {
                            context.HandleResponse();
                            if (context.Response.HasStarted)
                            {
                                return Task.CompletedTask;
                            }

                            context.Response.StatusCode = 401;
                            context.Response.ContentType = "application/json";
                            return context.Response.WriteAsync("{\"error\": \"You are not Authorized\"}");
                        },
                        OnForbidden = context =>
                        {
                            if (context.Response.HasStarted)
                            {
                                return Task.CompletedTask;
                            }

                            context.Response.StatusCode = 403;
                            context.Response.ContentType = "application/json";
                            return context.Response.WriteAsync("{\"error\": \"You are not authorized to access this resource\"}");
                        },
                    };
                });
        }

        public static IServiceCollection AddMarketDataServices(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<MarketDataSettings>(configuration.GetSection("MarketData"));
            services.AddMemoryCache();
            services.AddSingleton<MarketDataCache>();
            services.AddSingleton<IMarketDataCache>(sp => sp.GetRequiredService<MarketDataCache>());
            services.AddHostedService<MarketDataCacheEvictionService>();
            services.AddSingleton<CryptoEnrichmentService>();
            services.AddSingleton<ICryptoMarketEnrichmentProvider>(sp => sp.GetRequiredService<CryptoEnrichmentService>());
            services.AddSingleton<BistSessionManager>();
            services.AddSingleton<IBistSymbolProvider, BistSymbolProvider>();
            services.AddSingleton<YahooStreamRouter>();
            services.AddSingleton<IYahooPricingDecoder, YahooPricingDecoder>();
            services.AddSingleton<ForexHandler>();
            services.AddSingleton<GoldHandler>();
            services.AddSingleton<GoldCalculator>();
            services.AddSingleton<BistStockHandler>();
            services.AddSingleton<BistIndexHandler>();
            services.AddSingleton<CryptoHandler>();
            services.AddSingleton<YahooBistStreamService>();
            services.AddSingleton<IBistSubscriptionManager>(sp => sp.GetRequiredService<YahooBistStreamService>());
            services.AddHostedService(sp => sp.GetRequiredService<YahooBistStreamService>());
            services.AddHostedService<BinanceWebSocketService>();
            services.AddHostedService(sp => sp.GetRequiredService<CryptoEnrichmentService>());
            services.AddHostedService<DailySnapshotService>();

            return services;
        }

        public static IServiceCollection AddMarketDataBroadcaster<THub>(this IServiceCollection services)
            where THub : Hub
        {
            services.AddSingleton<IMarketDataBroadcaster, MarketDataBroadcaster<THub>>();
            return services;
        }
    }
}
