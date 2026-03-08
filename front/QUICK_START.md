# FinTreX Frontend - Environment Configuration Quick Start

## 📋 What's Been Created

✅ **Environment Files:**
- `.env.development` - Development configuration
- `.env.production` - Production configuration  
- `.env.example` - Template for reference

✅ **Services:**
- `EnvironmentConfigService` - Central configuration management
- `LoggerService` - Environment-aware logging
- `ApiHttpInterceptor` - Automatic API base URL injection

✅ **Scripts:**
- `scripts/build-env.js` - Environment file builder
- `scripts/build-env.sh` - Bash version
- `scripts/build-env.bat` - Windows batch version

✅ **Configuration:**
- `.gitignore` - Updated to ignore .env files
- `package.json` - New build scripts added
- `app.config.ts` - HTTP interceptor registered

---

## 🚀 Quick Start

### 1. Configure Your Environment

```bash
# Copy example to development
cp .env.example .env.development

# Edit with your local settings
# (Recommended: open .env.development in VS Code)
```

### 2. Update Configuration Values

Edit `.env.development`:
```env
API_BASE_URL=http://localhost:3000/api
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
BIST_API_KEY=your_local_key
```

### 3. Start Development Server

```bash
npm start
# Uses .env.development by default
```

### 4. Use in Your Code

**In Services:**
```typescript
import { EnvironmentConfigService } from './core/services/environment-config.service';

constructor(private env: EnvironmentConfigService) {
  const apiUrl = this.env.get('apiBaseUrl');
}
```

**In Components:**
```typescript
import { LoggerService } from './core/services/logger.service';

constructor(private logger: LoggerService) {
  this.logger.info('Component initialized');
}
```

---

## 📦 Build for Production

### Build Production Version

```bash
npm run build:prod
# Builds with production configuration
```

### Build Development Version

```bash
npm run build:dev
# Builds with development configuration
```

---

## 🔐 Security Checklist

- [x] `.env` files added to `.gitignore`
- [ ] Never commit `.env` files
- [ ] Use different API keys for dev/prod
- [ ] Keep Stripe publishable keys in control
- [ ] Use HTTPS URLs in production
- [ ] Rotate API keys regularly

---

## 📝 Environment Variables by Category

### API Configuration
```env
API_BASE_URL=http://localhost:3000/api
API_TIMEOUT=30000
```

### Authentication
```env
AUTH_API_URL=http://localhost:3000/api/auth
JWT_TOKEN_STORAGE_KEY=fintrex_auth_token
```

### Payment
```env
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
```

### Market Data
```env
BIST_API_URL=http://localhost:3001/api/bist
CRYPTO_API_URL=http://localhost:3001/api/crypto
PRECIOUS_METALS_API_URL=http://localhost:3001/api/metals
```

### Debugging & Logging
```env
DEBUG=true
LOG_LEVEL=debug
ENABLE_CONSOLE_LOGS=true
```

### Feature Flags
```env
ENABLE_DEMO_MODE=true
ENABLE_MOCK_DATA=false
```

---

## 🛠️ Using the HTTP Interceptor

The `ApiHttpInterceptor` automatically:
- Prepends `API_BASE_URL` to relative URLs
- Adds JWT token from localStorage
- Sets common headers (Content-Type, Accept)
- Handles errors gracefully

**Before:**
```typescript
this.http.get('/users')
```

**After Interception:**
```
GET http://localhost:3000/api/users
Headers: {
  Authorization: Bearer <token>,
  Content-Type: application/json
}
```

---

## 📊 Logging Examples

```typescript
// Debug
this.logger.debug('Loading user data', { userId: 123 });

// Info
this.logger.info('User logged in successfully');

// Warning
this.logger.warn('API response slow', { duration: '5000ms' });

// Error
this.logger.error('Failed to load portfolio', error);
```

---

## 🔄 Environment-Specific Logic

```typescript
import { EnvironmentConfigService } from './core/services/environment-config.service';

export class DataService {
  constructor(private env: EnvironmentConfigService) {}

  getData() {
    if (this.env.isDevelopment()) {
      // Use mock data in development
      return this.getMockData();
    } else {
      // Use real API in production
      return this.getApiData();
    }
  }
}
```

---

## 📚 Next Steps

1. Update `.env.development` with your local API URLs
2. Update `.env.production` with your production URLs
3. Test the HTTP interceptor by making API calls
4. Verify logging works with different log levels
5. Update backend API endpoints as they become available

---

## 🆘 Troubleshooting

### Variables not loading?
- Check file exists: `.env.development`
- Restart Angular dev server: `npm start`
- Check VS Code terminal for any errors

### API calls failing?
- Verify `API_BASE_URL` is correct
- Check backend is running
- Inspect Network tab in DevTools

### Interceptor not working?
- Verify imported in `app.config.ts`
- Check HTTP requests in DevTools Network
- Verify relative URLs (not starting with http://)

---

## 📖 Full Documentation

For detailed information, see [ENV_SETUP.md](./ENV_SETUP.md)
