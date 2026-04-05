import { Injectable } from '@angular/core';
import { EnvironmentConfigService } from './environment-config.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger Service
 * Provides structured logging with environment-aware configuration
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private logLevel: LogLevel;
  private enableConsoleLogs: boolean;

  private logLevelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(private envConfig: EnvironmentConfigService) {
    this.logLevel = this.envConfig.get('logLevel');
    this.enableConsoleLogs = this.envConfig.get('enableConsoleLogs');
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // Check if log level should be logged based on configuration
    if (this.logLevelOrder[level] < this.logLevelOrder[this.logLevel]) {
      return;
    }

    if (!this.enableConsoleLogs) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`, data);
        break;
      case 'info':
        console.info(`${prefix} ${message}`, data);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data);
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data);
        break;
    }
  }

  /**
   * Set log level at runtime
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}
