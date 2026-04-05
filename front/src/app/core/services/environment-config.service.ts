import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface EnvironmentConfig {
  appEnv: string;
  appName: string;
  debug: boolean;
  apiBaseUrl: string;
  apiTimeout: number;
  authApiUrl: string;
  jwtTokenStorageKey: string;
  stripePublishableKey: string;
  bistApiUrl: string;
  bistApiKey: string;
  cryptoApiUrl: string;
  cryptoApiKey: string;
  preciousMetalsApiUrl: string;
  preciousMetalsApiKey: string;
  marketDataApiUrl: string;
  marketDataUpdateInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableConsoleLogs: boolean;
  enableDemoMode: boolean;
  enableMockData: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EnvironmentConfigService {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): EnvironmentConfig {
    // Load from environment variables (build-time or runtime)
    return {
      appEnv: this.getEnv('APP_ENV', environment.production ? 'production' : 'development'),
      appName: this.getEnv('APP_NAME', 'FinTreX'),
      debug: this.getEnvAsBoolean('DEBUG', !environment.production),
      apiBaseUrl: this.getEnv('API_BASE_URL', environment.apiBaseUrl),
      apiTimeout: this.getEnvAsNumber('API_TIMEOUT', 30000),
      authApiUrl: this.getEnv('AUTH_API_URL', environment.authApiUrl),
      jwtTokenStorageKey: this.getEnv('JWT_TOKEN_STORAGE_KEY', 'fintrex_auth_token'),
      stripePublishableKey: this.getEnv('STRIPE_PUBLISHABLE_KEY', ''),
      bistApiUrl: this.getEnv('BIST_API_URL', ''),
      bistApiKey: this.getEnv('BIST_API_KEY', ''),
      cryptoApiUrl: this.getEnv('CRYPTO_API_URL', ''),
      cryptoApiKey: this.getEnv('CRYPTO_API_KEY', ''),
      preciousMetalsApiUrl: this.getEnv('PRECIOUS_METALS_API_URL', ''),
      preciousMetalsApiKey: this.getEnv('PRECIOUS_METALS_API_KEY', ''),
      marketDataApiUrl: this.getEnv('MARKET_DATA_API_URL', ''),
      marketDataUpdateInterval: this.getEnvAsNumber('MARKET_DATA_UPDATE_INTERVAL', 5000),
      logLevel: this.getEnv('LOG_LEVEL', 'debug') as 'debug' | 'info' | 'warn' | 'error',
      enableConsoleLogs: this.getEnvAsBoolean('ENABLE_CONSOLE_LOGS', true),
      enableDemoMode: this.getEnvAsBoolean('ENABLE_DEMO_MODE', true),
      enableMockData: this.getEnvAsBoolean('ENABLE_MOCK_DATA', false),
    };
  }

  /**
   * Get string environment variable
   */
  private getEnv(key: string, defaultValue: string = ''): string {
    // Check window object first (if available in browser)
    if (typeof window !== 'undefined' && (window as any).__ENV__) {
      return (window as any).__ENV__[key] || defaultValue;
    }
    return defaultValue;
  }

  /**
   * Get boolean environment variable
   */
  private getEnvAsBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.getEnv(key, String(defaultValue));
    return value === 'true' || value === '1' || value === 'yes';
  }

  /**
   * Get number environment variable
   */
  private getEnvAsNumber(key: string, defaultValue: number = 0): number {
    const value = this.getEnv(key, String(defaultValue));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get entire configuration
   */
  getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Get specific configuration value
   */
  get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.appEnv === 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.appEnv === 'production';
  }
}
