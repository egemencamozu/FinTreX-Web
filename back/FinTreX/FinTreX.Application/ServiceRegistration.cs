using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Services;
using Microsoft.Extensions.DependencyInjection;

namespace FinTreX.Core
{
    public static class ServiceRegistration
    {
        public static void AddApplicationLayer(this IServiceCollection services)
        {
            services.AddScoped<IPortfolioService, PortfolioService>();
            services.AddScoped<IEconomistClientService, EconomistClientService>();
            services.AddScoped<IEconomistApplicationService, EconomistApplicationService>();
            services.AddScoped<IConsultancyTaskService, ConsultancyTaskService>();
            services.AddScoped<ISubscriptionService, SubscriptionService>();
            services.AddScoped<IChatService, ChatService>();
            services.AddScoped<ISupportTicketService, SupportTicketService>();
            services.AddScoped<IWatchlistService, WatchlistService>();
            services.AddScoped<IPriceAlertService, PriceAlertService>();
        }
    }
}
