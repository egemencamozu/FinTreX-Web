# FinTreX Frontend - Environment Configuration Guide

## Overview

This project uses environment variables to manage different configurations for **Development** and **Production** environments.

## Environment Files

- **`.env.development`** - Development environment configuration (local machine)
- **`.env.production`** - Production environment configuration (deployed servers)
- **`.env.example`** - Template showing all available environment variables

## Setup Instructions

### 1. Create Development Environment

```bash
# Copy the example file to development
cp .env.example .env.development
```

Edit `.env.development` with your local values:
```
API_BASE_URL=http://localhost:3000/api
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
```

### 2. Create Production Environment

```bash
# Copy the example file to production
cp .env.example .env.production
```

Edit `.env.production` with your production values:
```
API_BASE_URL=https://api.fintrex.com/api
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
APP_ENV=production
```

## Using Environment Configuration

### In Services

```typescript
import { EnvironmentConfigService } from './core/services/environment-config.service';

@Injectable()
export class ApiService {
  constructor(private envConfig: EnvironmentConfigService) {}

  getApiUrl(): string {
    return this.envConfig.get('apiBaseUrl');
  }

  isDevelopment(): boolean {
    return this.envConfig.isDevelopment();
  }
}
```

### In Components

```typescript
import { EnvironmentConfigService } from './core/services/environment-config.service';

@Component({
  selector: 'app-root',
  template: `<h1>{{ appName }}</h1>`
})
export class AppComponent {
  appName: string;

  constructor(private envConfig: EnvironmentConfigService) {
    this.appName = this.envConfig.get('appName');
  }
}
```

## Build Commands

### Development Build

```bash
npm run build:dev
# or
ng build --configuration development
```

### Production Build

```bash
npm run build:prod
# or
ng build --configuration production
```

### Start Development Server

```bash
npm start
# Automatically loads .env.development
```

## Environment Variables Reference

### Application Configuration

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `APP_ENV` | string | `development` \| `production` | Determines active environment |
| `APP_NAME` | string | `FinTreX` | Application name |
| `DEBUG` | boolean | `true` \| `false` | Enable debug mode |

### API Endpoints

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `API_BASE_URL` | string | `http://localhost:3000/api` | Main backend API URL |
| `API_TIMEOUT` | number | `30000` | HTTP request timeout in ms |
| `AUTH_API_URL` | string | `http://localhost:3000/api/auth` | Authentication endpoint |

### Payment Integration

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `STRIPE_PUBLISHABLE_KEY` | string | `pk_test_...` | Stripe publishable key (never expose secret key) |

### Market Data APIs

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `BIST_API_URL` | string | `http://localhost:3001/api/bist` | BIST stock market API |
| `BIST_API_KEY` | string | `dev_key_123` | BIST API authentication key |
| `CRYPTO_API_URL` | string | `http://localhost:3001/api/crypto` | Cryptocurrency API |
| `CRYPTO_API_KEY` | string | `dev_key_456` | Crypto API authentication key |
| `PRECIOUS_METALS_API_URL` | string | `http://localhost:3001/api/metals` | Precious metals API |
| `PRECIOUS_METALS_API_KEY` | string | `dev_key_789` | Metals API authentication key |

### Logging

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `LOG_LEVEL` | string | `debug` \| `info` \| `warn` \| `error` | Log level filter |
| `ENABLE_CONSOLE_LOGS` | boolean | `true` \| `false` | Enable console logging |

### Feature Flags

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `ENABLE_DEMO_MODE` | boolean | `true` \| `false` | Demo mode for testing |
| `ENABLE_MOCK_DATA` | boolean | `true` \| `false` | Use mock data instead of real API |

## Best Practices

### Security

✅ **DO:**
- Store sensitive keys (JWT secrets, API keys) in `.env` files
- Add `.env` files to `.gitignore` (already configured)
- Never commit `.env` files to version control
- Use different keys for development and production

❌ **DON'T:**
- Expose secret API keys in the code
- Commit `.env` files to Git
- Use production keys in development
- Store passwords in plaintext

### Environment-Specific Logic

```typescript
if (this.envConfig.isDevelopment()) {
  console.log('Development mode - enabling debug features');
} else if (this.envConfig.isProduction()) {
  console.log('Production mode - disabling debug features');
}
```

## Troubleshooting

### Variables not loading?

1. Check that the `.env.*` file exists
2. Verify file naming matches expected pattern
3. Restart Angular dev server: `npm start`

### Different values in production?

1. Update `.env.production` with correct values
2. Rebuild with production configuration
3. Verify using browser DevTools Network tab

### API calls failing?

1. Check `API_BASE_URL` is correct
2. Verify backend is running
3. Check CORS settings if calling external APIs

## CI/CD Integration

For automated deployments, provide environment variables:

```bash
# GitHub Actions
env:
  API_BASE_URL: https://api.fintrex.com/api
  STRIPE_PUBLISHABLE_KEY: pk_live_xxx
```

```bash
# Docker
ENV API_BASE_URL=https://api.fintrex.com/api
ENV STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```
