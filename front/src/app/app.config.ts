import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  withInterceptorsFromDi,
  withFetch,
} from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ApiHttpInterceptor } from './core/interceptors/api-http.interceptor';
import { EnvironmentConfigService } from './core/services/environment-config.service';
import { UserManagementRepository } from './core/interfaces/user-management.repository';
import { UserManagementApiRepository } from './data/repositories/user-management-api.repository';
import { ConsultancyTaskRepository } from './core/interfaces/consultancy-task.repository';
import { ConsultancyTaskApiRepository } from './data/repositories/consultancy-task-api.repository';
import { EconomistRepository } from './core/interfaces/economist.repository';
import { EconomistApiRepository } from './data/repositories/economist-api.repository';
import { SubscriptionRepository } from './core/interfaces/subscription.repository';
import { SubscriptionApiRepository } from './data/repositories/subscription-api.repository';
import { MarketDataRepository } from './core/interfaces/market-data.repository';
import { MarketDataApiRepository } from './data/repositories/market-data-api.repository';
import { PortfolioRepository } from './core/interfaces/portfolio.repository';
import { PortfolioApiRepository } from './data/repositories/portfolio-api.repository';
import { ChatRepository } from './core/interfaces/chat.repository';
import { ChatApiRepository } from './data/repositories/chat-api.repository';
import { AiAssistantRepository } from './core/interfaces/ai-assistant.repository';
import { AiAssistantApiRepository } from './data/repositories/ai-assistant-api.repository';
import { AdminStatsRepository } from './core/interfaces/admin-stats.repository';
import { AdminStatsApiRepository } from './data/repositories/admin-stats.repository.impl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideCharts(withDefaultRegisterables()),


    // Register HTTP Interceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiHttpInterceptor,
      multi: true,
    },

    // Provide EnvironmentConfigService
    EnvironmentConfigService,

    // Bind core abstractions to data layer implementations
    { provide: UserManagementRepository, useClass: UserManagementApiRepository },
    { provide: ConsultancyTaskRepository, useClass: ConsultancyTaskApiRepository },
    { provide: EconomistRepository, useClass: EconomistApiRepository },
    { provide: SubscriptionRepository, useClass: SubscriptionApiRepository },
    { provide: MarketDataRepository, useClass: MarketDataApiRepository },
    { provide: PortfolioRepository, useClass: PortfolioApiRepository },
    { provide: ChatRepository, useClass: ChatApiRepository },
    { provide: AiAssistantRepository, useClass: AiAssistantApiRepository },
    { provide: AdminStatsRepository, useClass: AdminStatsApiRepository },
  ],
};
