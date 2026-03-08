# FinTreX — Project Architecture & AI Context Guide

> This file is the **single source of truth** for any AI assistant (GitHub Copilot, Cursor, Claude, etc.) working on this codebase.
> Before generating, editing, or suggesting code — **read and obey every rule in this document.**

---

## PART I — Project Foundation

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project | FinTreX — Financial Portfolio Management System |
| Frontend | Angular 19+ (Standalone Components, SSR-ready) |
| Backend | .NET REST API (separate repository) |
| Database | Azure SQL (backend-side) |
| Payments | Stripe API |
| Market Data | External REST APIs (BIST, Crypto, Precious Metals) |
| Auth | JWT (cookie-based sessions are strictly forbidden) |
| Hosting | Microsoft Azure |
| Language | TypeScript (strict mode) |
| Styling | SCSS |

---

## 2. Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Angular 19+ |
| Component Model | Standalone Components (no NgModule) |
| Routing | Lazy-loaded feature routes |
| HTTP | HttpClient + Functional Interceptors |
| Guards | Functional CanActivateFn |
| Styling | SCSS + CSS Custom Properties (design tokens) |
| State | Angular Signals or RxJS (per feature needs) |
| Charts | TBD (ng2-charts or ngx-echarts candidates) |
| Chat | SignalR or WebSocket (real-time, NF3: < 1 second latency) |
| Payments | Stripe.js / Stripe Elements |
| i18n | Angular i18n or ngx-translate (TR + EN support) |
| Theme | Dark / Light mode (CSS custom properties + toggle) |
| Testing | Jasmine + Karma (unit), Cypress or Playwright (e2e) |

---

## 3. User Roles

The system has 3 roles. Each role sees a different layout, different sidebar, different feature set:

### USER (Standard Investor)
- Creates portfolios, adds/removes assets, maintains watchlists
- Views asset distribution via dynamic pie chart
- Upgrades subscription (Default → Premium → Ultra), cancels, updates payment method
- Gets assigned an Economist, creates analysis tasks, rates Economist (1-5 stars)
- Chats with Economist in real-time (daily message limit depends on subscription tier)
- Edits profile, deletes account, toggles theme (dark/light)

### ECONOMIST (Consultant)
- Views assigned clients' portfolios in **strictly read-only mode**
- **CRITICAL SECURITY CONSTRAINT:** An Economist can **never** buy/sell/trade/transfer on behalf of a user. The UI must **never render** any button, link, or form that allows mutation of a user's portfolio. This is an architectural constraint, not just an authorization check.
- Responds to analysis tasks, writes reports
- Chats with assigned users
- Keeps personal timestamped notes

### ADMIN
- Evaluates Economist applications (approve/reject)
- Manages User/Economist accounts (suspend/ban)
- Configures subscription tier limits (max portfolios, daily chat limit, etc.)
- Reviews Economist change requests
- Audits Economist performance metrics

---

## 4. Subscription Tier System

| Feature | DEFAULT | PREMIUM | ULTRA |
|---|---|---|---|
| Portfolio limit | Restricted | Higher | Highest |
| Daily chat limit | Restricted | Higher | Near unlimited |
| Economist assignment | Automatic (random) | Selectable (browse profiles) | Selectable (browse profiles) |
| Task assignments | Restricted | Higher | Highest |

> **Limits are dynamically configurable by Admin (FR15). Never hardcode limit values.** Always fetch from backend config and use them reactively.

---

## PART II — Architecture

---

## 5. Architecture: Clean Architecture

```
┌─────────────────────────────────────────────┐
│              presentation/                   │  ← UI layer (Angular components, routes)
│  ┌─────────────────────────────────────┐    │
│  │             core/                    │    │  ← Domain layer (models, rules, contracts)
│  │                                      │    │
│  └─────────────────────────────────────┘    │
│              data/                           │  ← Infrastructure layer (API calls, external)
└─────────────────────────────────────────────┘
```

### Dependency Rule (Never Violate)

```
presentation/ → core/         ✅  presentation can import from core
presentation/ → data/         ❌  FORBIDDEN — never import data layer directly
data/         → core/         ✅  data implements core's abstract classes
core/         → data/         ❌  FORBIDDEN
core/         → presentation/ ❌  FORBIDDEN
data/         → presentation/ ❌  FORBIDDEN
```

The `presentation/` layer injects `core/interfaces/` abstract classes — never concrete classes from `data/`. Bindings are configured in `app.config.ts` providers.

---

## 6. Folder Structure & Responsibilities

```
src/app/
├── core/                          # Domain layer — framework-agnostic
│   ├── models/                    # Data models (TypeScript interfaces)
│   ├── enums/                     # Constant value sets (string enums)
│   ├── interfaces/                # Repository & Service contracts (abstract classes)
│   ├── use-cases/                 # Single-responsibility business logic units
│   ├── interceptors/              # HTTP interceptors (functional)
│   └── guards/                    # Route guards (functional)
│
├── data/                          # Infrastructure layer — external communication
│   ├── repositories/              # Concrete implementations of core/interfaces/
│   └── external-services/         # Third-party integrations (Stripe, market APIs)
│
└── presentation/                  # UI layer
    ├── layout/                    # App shell (sidebar, navbar, router-outlet)
    │   └── main-layout/           # Role-based main layout
    ├── shared/                    # Cross-feature reusable UI pieces
    │   ├── components/            # Generic components (button, modal, ...)
    │   ├── cards/                 # Card components (portfolio-card, economist-card, ...)
    │   ├── charts/                # Chart components (dynamic-pie-chart, ...)
    │   └── pipes/                 # Common pipes (currency-format, ...)
    └── features/                  # Lazy-loaded feature modules
        ├── auth/                  # Login, register, password reset
        ├── dashboard/             # Portfolios, watchlist, market data
        ├── subscription/          # Plan management, billing, Stripe
        ├── consultancy/           # Economist assignment, tasks, ratings
        ├── chat/                  # Real-time messaging
        ├── profile/               # Profile editing, account deletion, settings
        └── admin/                 # Admin panel
```

---

## 7. Layer Details

### 7.1 core/models/

Pure TypeScript interfaces that represent domain entities. **No Angular imports allowed here.**

| File | Purpose |
|---|---|
| `user.model.ts` | User identity (id, name, surname, email, role, subscriptionTier, avatarUrl) |
| `portfolio.model.ts` | Portfolio (id, userId, name, assets array, createdAt) |
| `asset.model.ts` | Financial asset (id, symbol, name, market type, quantity, currentPrice) |
| `subscription.model.ts` | Subscription (id, userId, tier, status, currentPeriodEnd) |
| `economist.model.ts` | Economist profile (id, userId, specialization, averageRating, isAcceptingClients) |
| `task.model.ts` | Analysis task (id, userId, economistId, description, status, createdAt) |

**When adding a new model:** Place it here as `kebab-case.model.ts`. Keep models independent — resolve cross-references via imports, never create circular dependencies.

### 7.2 core/enums/

String enums for backend compatibility. **Values must always be string literals.**

| File | Values |
|---|---|
| `user-role.enum.ts` | `USER`, `ECONOMIST`, `ADMIN` |
| `subscription-tier.enum.ts` | `DEFAULT`, `PREMIUM`, `ULTRA` |

**When adding a new enum:** Use `kebab-case.enum.ts`. Always use `KEY = 'KEY'` format.

### 7.3 core/interfaces/

Defined as **abstract classes** because TypeScript interfaces cannot be injected via Angular DI.

| File | Contract |
|---|---|
| `portfolio.repository.ts` | Portfolio CRUD operations |
| `payment.service.ts` | Subscription payment, cancellation, method update |

**When adding a new contract:** Create as `kebab-case.repository.ts` or `kebab-case.service.ts`. Define method signatures only — implementation goes in `data/`.

### 7.4 core/use-cases/

Each use-case represents a single business rule. One class, one `execute()` method.

| File | Business Rule |
|---|---|
| `add-asset.uc.ts` | Add an asset to a portfolio |
| `assign-economist.uc.ts` | Assign an Economist to a user (random for Default, selectable for Premium/Ultra) |

**When adding a new use-case:** Use `kebab-case.uc.ts`. Inject required repositories/services via constructor. One responsibility per use-case — if it does two things, split it.

### 7.5 core/interceptors/

Angular 17+ **functional interceptor** format only. Class-based interceptors are forbidden.

| File | Job |
|---|---|
| `jwt.interceptor.ts` | Attaches `Authorization: Bearer <token>` header to every outgoing HTTP request |
| `error.interceptor.ts` | Catches HTTP errors, redirects to login on 401, shows user-facing notification |

### 7.6 core/guards/

Angular 17+ **functional guard** format only. Class-based guards are forbidden.

| File | Job |
|---|---|
| `auth.guard.ts` | Validates JWT existence and expiry, redirects to login if invalid |
| `role.guard.ts` | Compares user role against route's `data.requiredRole` |

**Role guard route definition pattern:**
```ts
{
  path: 'admin',
  canActivate: [roleGuard],
  data: { requiredRole: UserRole.ADMIN },
  loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
}
```

### 7.7 data/repositories/

Concrete implementations of `core/interfaces/` abstract classes. Makes HTTP calls to the .NET REST API.

**Rules:**
- Use `@Injectable({ providedIn: 'root' })`
- Inject `HttpClient`
- All HTTP calls must return `Observable`, not `Promise`
- Never hardcode API URLs — pull from environment files

### 7.8 data/external-services/

Third-party service integrations.

| File | Service |
|---|---|
| `stripe-payment.service.ts` | Stripe payments and subscription lifecycle |
| `market-data.service.ts` | BIST, Crypto, Precious Metals price feeds |

### 7.9 presentation/layout/

The app shell. Sidebar, navbar, footer, and `<router-outlet>` live here.

`main-layout/` component is **role-aware:**
- **USER:** Portfolio-centric sidebar (Dashboard, Watchlist, Consultancy, Chat, Subscription)
- **ECONOMIST:** Client-centric sidebar (My Customers, Tasks, Chat, Notes)
- **ADMIN:** Management sidebar (Users, Economists, Applications, Config, Audit)

### 7.10 presentation/shared/

Reusable, stateless UI components shared across features.

**Rules:**
- Every shared component must be `standalone: true`
- Feature-specific components do NOT belong here — keep them in their feature folder
- Shared components contain NO business logic — they communicate via `@Input()` / `@Output()` only

### 7.11 presentation/features/

Each feature is a lazy-loaded route module with its own route file, page components, and feature-specific components.

| Feature | Route File | Scope (SRS Reference) |
|---|---|---|
| `auth/` | `auth.routes.ts` | Login, Register (role selection), Forgot Password — FR1, FR2 |
| `dashboard/` | `dashboard.routes.ts` | Portfolio CRUD, watchlist, market data, pie chart — FR7 |
| `subscription/` | `subscription.routes.ts` | Plan upgrade, cancellation, payment update — FR4, FR5, FR6 |
| `consultancy/` | `consultancy.routes.ts` | Economist assignment, task creation/response, rating — FR8, FR9, FR10, FR12 |
| `chat/` | `chat.routes.ts` | Real-time messaging, daily limit enforcement — FR11 |
| `profile/` | `profile.routes.ts` | Profile editing, account deletion, theme toggle — FR3, OR2 |
| `admin/` | `admin.routes.ts` | Account management, applications, config, audit — FR13, FR14, FR15, FR16 |

**Feature internal structure (as a feature grows):**
```
features/dashboard/
├── dashboard.routes.ts          # Route definitions
├── pages/                       # Page components (routed)
│   ├── portfolio-list/
│   ├── portfolio-detail/
│   └── market-detail/
├── components/                  # Feature-specific components (not routed)
│   ├── asset-search/
│   └── watchlist-table/
└── services/                    # Feature-specific services (optional)
```
---

## PART III — Constraints & Principles

---

## 8. Security Constraints ⚠️

**Never generate code that violates these rules:**

### 8.1 Economist Read-Only Constraint
```
❌ NEVER: Render buy/sell/trade/transfer buttons, forms, or actions for the Economist role
❌ NEVER: Write API calls that allow an Economist to mutate a user's portfolio
✅ ALWAYS: Hide all mutation actions when the current user's role is ECONOMIST
✅ ALWAYS: Use role checks in components — if (role === UserRole.ECONOMIST) → do not render mutation UI
```

### 8.2 JWT Rules
```
❌ NEVER: Use cookie-based sessions
❌ NEVER: Store tokens in cookies
✅ ALWAYS: Send JWT via Authorization header as Bearer token
✅ ALWAYS: Redirect to login when token expires
```

### 8.3 Payment Security
```
❌ NEVER: Store credit card numbers in frontend state, variables, or logs
❌ NEVER: POST payment details to our own backend — Stripe handles this
✅ ALWAYS: Use Stripe Elements or Stripe.js to send payment info directly to Stripe
```

---

## 9. SOLID Principles

Every piece of code in this project must adhere to SOLID. These are not suggestions — they are constraints:

### Single Responsibility Principle (SRP)
- One class / one function = one reason to change.
- A component that both fetches data AND renders UI is a violation. Extract data-fetching into a service.
- A use-case that handles two business operations is a violation. Split it into two files.
- A service that talks to two different APIs should be split into two services.
- **Controller/UI Separation:** UI components must strictly bind data and emit user events. ALL business decision-making and role-based validations must happen within `core/use-cases/`. This guarantees that core logic can be seamlessly triggered by non-UI actors (e.g., background jobs, system events) in the future without refactoring.

### Open/Closed Principle (OCP)
- Code should be open for extension but closed for modification.
- Use strategy patterns, dependency injection, and configuration over conditionals.
- When adding a new subscription tier, you should not modify existing tier logic — add new behavior, don't rewrite old behavior.
- When a new chart type is needed, extend — don't modify `dynamic-pie-chart` to also handle bar charts.

### Liskov Substitution Principle (LSP)
- Any class that extends an abstract class must be fully substitutable.
- `PortfolioApiRepository` must fulfill the entire contract of `PortfolioRepository` — no method should throw `NotImplementedError` or silently do nothing.

### Interface Segregation Principle (ISP)
- Keep interfaces small and focused. Do not create a single `DataService` abstract class with 30 methods.
- If a consumer only needs portfolio reads, it should not depend on an interface that also exposes writes.
- Prefer multiple small contracts over one large contract.

### Dependency Inversion Principle (DIP)
- High-level modules (`presentation/`, `core/use-cases/`) must not depend on low-level modules (`data/`).
- Both should depend on abstractions (`core/interfaces/`).
- This is the foundation of our Clean Architecture — the dependency rule in Section 5 IS the DIP in action.

---

## 10. General Engineering Principles

### 10.1 No Hardcoding — Anywhere

```ts
// ❌ NEVER
if (portfolioCount >= 5) { ... }
const API = 'https://api.fintrex.com/v1';
setTimeout(() => {}, 3000);

// ✅ ALWAYS
if (portfolioCount >= this.subscriptionConfig.maxPortfolios) { ... }
const API = environment.apiUrl;
setTimeout(() => {}, DEBOUNCE_DELAY_MS);
```

This applies to limits, URLs, delays, sizes, keys, feature flags, and tier names. If a value might change or differs between environments, it must not be a literal in the code.

### 10.2 Modular Independence & "Drop-out" Readiness
- **Strict Feature Isolation:** Every folder under `presentation/features/` must act as an independent plugin. If ANY feature module is completely deleted from the codebase, the rest of the application MUST compile and function without errors.
- **No Cross-Feature Imports:** Never import a component, route, model, or service from one feature into another. If two features need to share data or logic, that shared logic must be hoisted to `core/` or `shared/`.

### 10.3 Loose Coupling

- Components should not know about each other. Communicate via services, router, or `@Input()` / `@Output()`.
- Services should not know about components.
- Features should not import from other features. Shared needs go to `shared/` or `core/`.
- Cross-feature communication goes through `core/` services — never direct feature-to-feature imports.

### 10.4 Composition Over Inheritance

- Use Angular's DI, pipes, directives, and composition to share behavior.
- Avoid deep component inheritance chains. If A extends B extends C — refactor into smaller composed components.
- Utility functions and mixins are preferred over base classes for shared logic.

### 10.5 Error Handling

- Every HTTP call must have error handling. Never let Observables error-propagate unhandled.
- Use `catchError` in services, not in components.
- User-facing error messages must be clear and actionable. Never expose raw API error responses.
- Network failures, API errors, and validation errors should have distinct handling strategies.

### 10.6 Observable & Async Patterns

```ts
// ❌ NEVER — nested subscriptions
this.authService.getUser().subscribe(user => {
  this.portfolioService.getByUserId(user.id).subscribe(portfolios => { ... });
});

// ✅ ALWAYS — RxJS operators
this.authService.getUser().pipe(
  switchMap(user => this.portfolioService.getByUserId(user.id)),
).subscribe(portfolios => { ... });
```

- Never nest subscriptions. Use `switchMap`, `mergeMap`, `concatMap`, or `combineLatest`.
- Always unsubscribe — use `takeUntilDestroyed()`, `async` pipe, or `DestroyRef`.
- Prefer the `async` pipe in templates over manual subscriptions in component classes.

### 10.7 YAGNI & Architectural Evolution (Anti-Over-Engineering)
- **Code for Current Requirements Only:** Implement only the actors, roles, and features explicitly defined in the current specifications. Do not build speculative abstractions, complex generic factories, or placeholder interfaces for future automated actors or system expansions.
- **Domain Purity as Future-Proofing:** The ease of replacing or augmenting human actors with automated systems in the future comes purely from keeping `core/use-cases/` entirely free of UI and framework logic. Keep business rules strict and isolated; do not over-engineer the UI to anticipate future changes.
---

## PART IV — Code Standards

---

## 11. TypeScript & Angular Code Standards

### 11.1 Type Safety

```ts
// ❌ NEVER
const user: any = response.data;
const items = [];
function process(data) { }

// ✅ ALWAYS
const user: User = response.data;
const items: Asset[] = [];
function process(data: Portfolio): Observable<Portfolio> { }
```

- **Never use `any`.** If the type is truly unknown, use `unknown` and narrow it with type guards.
- **Never leave function return types implicit** on services and use-cases.
- **Always type arrays** — `Asset[]` not `[]`.
- Every API response shape must have a corresponding interface in `core/models/`.

### 11.2 Model-First Development

**Domain entities and API response shapes must always have a model in `core/models/`:**

```ts
// ❌ NEVER — inline shapes for API calls or domain objects
this.http.get<{ id: string; name: string; assets: { symbol: string }[] }>('/api/portfolios');

// ✅ ALWAYS — reference the model
this.http.get<Portfolio[]>(`${environment.apiUrl}/portfolios`);
```

**When to create a model file in `core/models/`:**
- It represents a domain entity (User, Portfolio, Asset, Task, etc.)
- It is an API request/response shape used across multiple features
- It is shared between 3 or more files

**When a local interface is fine (no separate model file needed):**
- A component's `@Input()` prop type used only in that component
- A small utility type like `{ label: string; value: string }` for a dropdown
- A form-specific shape used only within one feature
- A temporary mapping type used in a single service method

Local interfaces can live inside the component/service file or in a `types.ts` file within the feature folder.

**DTOs:** API-specific shapes that differ from domain models go in `data/` layer, not `core/models/`. Map them to domain models before passing to presentation.

### 11.3 Component Standards

```ts
// ✅ CORRECT
@Component({
  selector: 'app-portfolio-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './portfolio-card.component.html',
  styleUrl: './portfolio-card.component.scss',
})
export class PortfolioCardComponent {}

// ❌ WRONG
@NgModule({ declarations: [PortfolioCardComponent] })
```

- **NgModule is forbidden.** All components use `standalone: true`.
- Inline `template:` is acceptable for short templates (< 10 lines). Otherwise, use a separate `.html` file.
- Every component must have its own `.scss` file (or inline `styles:` for trivial cases).
- Component selector prefix is always `app-`.

### 11.4 Angular CLI — Always Use `ng generate`

**Never create Angular artifacts (components, services, pipes, guards, directives) by manually creating files.** Always use Angular CLI so that the correct file structure, naming convention, boilerplate, and test file are generated consistently.

```bash
# Components — always generate into the correct path
ng g c presentation/features/dashboard/pages/portfolio-list --standalone
ng g c presentation/shared/components/confirm-dialog --standalone

# Services
ng g s data/repositories/user-api

# Pipes
ng g p presentation/shared/pipes/relative-time --standalone

# Guards (functional by default in Angular 17+)
ng g guard core/guards/subscription --functional

# Interceptors (functional)
ng g interceptor core/interceptors/loading --functional

# Directives
ng g d presentation/shared/directives/role-visible --standalone
```

**Rules:**
- Always pass the full relative path so files land in the correct folder. Never generate at root and move manually.
- Always add `--standalone` flag for components, pipes, and directives (ensures no NgModule is created).
- Always add `--functional` flag for guards and interceptors.
- Never use `--skip-tests`. Every artifact must have a `.spec.ts` file generated alongside it. If the test is not needed immediately, leave the generated skeleton — do not delete it.
- If the CLI generates an `NgModule`, something is wrong. Delete it and re-run with `--standalone`.
- For components that need inline template/styles (very small components), use `--inline-template --inline-style` flags.

**Why:** Manual file creation leads to inconsistent naming (e.g., forgetting the `.component` suffix), missing test files, missing standalone flag, and wrong folder placement. The CLI enforces the project's conventions automatically.

### 11.5 Service & DI Standards

```ts
// ✅ Abstract contract in core/interfaces/
export abstract class PortfolioRepository {
  abstract getAll(): Observable<Portfolio[]>;
}

// ✅ Concrete implementation in data/repositories/
@Injectable({ providedIn: 'root' })
export class PortfolioApiRepository extends PortfolioRepository {
  private http = inject(HttpClient);

  getAll(): Observable<Portfolio[]> {
    return this.http.get<Portfolio[]>(`${environment.apiUrl}/portfolios`);
  }
}

// ✅ Binding in app.config.ts
providers: [
  { provide: PortfolioRepository, useClass: PortfolioApiRepository },
]

// ❌ WRONG — importing data layer from presentation
import { PortfolioApiRepository } from '../../data/repositories/portfolio-api.repository';
```

- Prefer `inject()` function over constructor injection.
- All HTTP calls return `Observable`, never `Promise`.
- Never hardcode API URLs — always use `environment.apiUrl`.

### 11.6 Routing Standards

```ts
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./presentation/features/dashboard/dashboard.routes')
          .then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { requiredRole: UserRole.ADMIN },
        loadChildren: () => import('./presentation/features/admin/admin.routes')
          .then(m => m.ADMIN_ROUTES),
      },
    ]
  },
  {
    path: 'auth',
    loadChildren: () => import('./presentation/features/auth/auth.routes')
      .then(m => m.AUTH_ROUTES),
  },
];
```

**Route separation rule:** Every feature must define its own route array in its own `*.routes.ts` file. Never dump all routes into a single `app.routes.ts`. The main `app.routes.ts` only contains top-level paths and `loadChildren` references — it never contains page-level route definitions.

```
app.routes.ts          → only top-level paths + loadChildren (this is the ONLY place that wires features together)
auth.routes.ts         → login, register, forgot-password routes
dashboard.routes.ts    → portfolio-list, portfolio-detail, watchlist, market-detail routes
subscription.routes.ts → plan-selection, billing, payment-update routes
consultancy.routes.ts  → economist-assign, task-list, task-detail, rating routes
chat.routes.ts         → conversation-list, conversation-detail routes
profile.routes.ts      → profile-edit, account-delete, settings routes
admin.routes.ts        → user-management, economist-applications, config, audit routes
```

**Why:** Each feature's routes are lazy-loaded as a separate bundle. If routes are centralized in one file, Angular cannot code-split them, which kills initial load performance. It also creates tight coupling — every feature change touches the same file.

Other routing rules:
- Auth routes sit **outside** the layout (no sidebar on login page).
- All other features are **children** of `MainLayoutComponent`.
- Admin routes are protected by `roleGuard`.
- Every feature uses `loadChildren` for lazy loading. Eager loading is forbidden.

---

## 12. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case` + suffix | `portfolio-card.component.ts` |
| Classes | `PascalCase` | `PortfolioCardComponent` |
| Interfaces / Models | `PascalCase` | `Portfolio`, `Asset` |
| Enums | `PascalCase` (type), `UPPER_CASE` (values) | `UserRole.ADMIN` |
| Variables & functions | `camelCase` | `portfolioCount`, `getAssets()` |
| CSS classes | `kebab-case` or BEM | `card-header`, `card__title--active` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEBOUNCE_DELAY_MS` |
| Route paths | `kebab-case` | `/portfolio-detail`, `/my-subscriptions` |
| Event emitters | `camelCase`, verb-based | `assetAdded`, `taskCompleted` |

---

## 13. File Suffixes

| Type | Suffix | Example |
|---|---|---|
| Model | `.model.ts` | `portfolio.model.ts` |
| Enum | `.enum.ts` | `user-role.enum.ts` |
| Abstract contract | `.repository.ts` / `.service.ts` | `portfolio.repository.ts` |
| Use Case | `.uc.ts` | `add-asset.uc.ts` |
| Guard | `.guard.ts` | `auth.guard.ts` |
| Interceptor | `.interceptor.ts` | `jwt.interceptor.ts` |
| Component | `.component.ts` | `portfolio-card.component.ts` |
| Pipe | `.pipe.ts` | `currency-format.pipe.ts` |
| Directive | `.directive.ts` | `role-visible.directive.ts` |
| Route | `.routes.ts` | `dashboard.routes.ts` |
| Service (concrete) | `.service.ts` | `market-data.service.ts` |
| Spec / Test | `.spec.ts` | `portfolio-card.component.spec.ts` |
---

## 14. SCSS & Styling Standards

### 14.1 Design Tokens — Comprehensive Dictionary

> **ABSOLUTE RULE: Never invent a new token.** Every color, spacing, shadow, and radius value
> used in any component SCSS must come from `styles.scss`. If the token you need doesn't exist,
> **stop and ask** — the design system owner will either point you to the correct existing token
> or add a new one intentionally. Silently introducing a raw hex value is a violation.

This dictionary tells you exactly **which token to use for which purpose.** When in doubt, consult this table before writing any SCSS.

---

#### 14.1.1 Raw Color Scales (Primitives)

These are the **raw material**. Components should rarely reference these directly — use the semantic tokens below instead. Use raw scales only when building a new semantic token or a very specific one-off visual.

**Brand Colors**

| Scale | Token Pattern | Purpose |
|---|---|---|
| Navy 50–950 | `--color-navy-{50..950}` | Primary brand. Trust, professionalism. 50 = near-white tint, 900 = near-black shade |
| Gold 50–950 | `--color-gold-{50..950}` | Accent. Wealth, premium, CTAs. 600 is the standard "gold" |
| Slate 50–950 | `--color-slate-{50..950}` | Neutral backbone. Secondary text, borders, muted backgrounds |

**Semantic Colors**

| Scale | Token Pattern | When to Use |
|---|---|---|
| Success 50–950 | `--color-success-{50..950}` | Profit, positive change, confirmations, "green" indicators |
| Danger 50–950 | `--color-danger-{50..950}` | Loss, errors, destructive actions, negative P&L |
| Warning 50–950 | `--color-warning-{50..950}` | Caution, pending states, approaching limits |
| Info 50–950 | `--color-info-{50..950}` | Informational messages, links, secondary actions |

**Neutral Gray**

| Scale | Token Pattern | When to Use |
|---|---|---|
| Gray 50–950 | `--color-gray-{50..950}` | Pure gray (no blue undertone). Dividers, disabled states, skeletons |

**Scale Logic (applies to all scales):**
- **50–100:** Subtle backgrounds, tinted surfaces, light badges
- **200–300:** Borders, dividers, disabled backgrounds
- **400–500:** Placeholder text, muted icons, secondary elements
- **600–700:** Standard visible elements, readable text on light backgrounds
- **800–900:** Strong emphasis, headings on light backgrounds
- **950:** Near-black, rarely used directly

---

#### 14.1.2 Surfaces & Backgrounds

**"Which background should I use?"** — Use this decision tree:

| Token | Use When |
|---|---|
| `--bg-app` | Page body, deepest background layer |
| `--bg-surface` | Cards, panels, content containers (sits on top of app bg) |
| `--bg-surface-raised` | Elevated elements: dropdowns, popovers, floating panels (sits on top of surface) |
| `--bg-surface-overlay` | Semi-transparent backdrop behind modals and dialogs |
| `--bg-sidebar` | Main navigation sidebar background |
| `--bg-sidebar-hover` | Sidebar menu item on hover |
| `--bg-sidebar-active` | Currently active sidebar menu item |
| `--bg-navbar` | Top navigation bar |
| `--bg-footer` | Footer area |
| `--bg-input` | Text inputs, selects, textareas |
| `--bg-input-disabled` | Disabled form fields |
| `--bg-input-focus` | Focused form fields |
| `--bg-badge` | Default badge/chip background |
| `--bg-tooltip` | Tooltip background |
| `--bg-skeleton` | Skeleton loader placeholder blocks |

**Semantic tinted backgrounds** (for alerts, banners, status tags):

| Token | Use When |
|---|---|
| `--bg-success-subtle` | Success alert bg, "Completed" tag bg, positive status row |
| `--bg-danger-subtle` | Error alert bg, "Rejected" tag bg, negative status row |
| `--bg-warning-subtle` | Warning alert bg, "Pending" tag bg, limit-approaching notification |
| `--bg-info-subtle` | Info alert bg, "New" tag bg, informational banner |
| `--bg-gold-subtle` | Premium/Ultra badge bg, subscription feature highlight |
| `--bg-navy-subtle` | Brand-tinted section bg, marketing callout |

---

#### 14.1.3 Text Colors

**"Which text color should I use?"**

| Token | Use When | Example |
|---|---|---|
| `--text-primary` | Main content, headings, body text | Page titles, card body text |
| `--text-secondary` | Supporting info, descriptions | "Last updated 2 hours ago" |
| `--text-tertiary` | Least important text | Timestamps, hints, footnotes |
| `--text-disabled` | Disabled labels and values | Grayed-out form labels |
| `--text-inverse` | Text on dark backgrounds | Text inside sidebar, tooltip, dark banner |
| `--text-link` | Clickable hyperlinks | "View details" link |
| `--text-link-hover` | Hyperlink on hover | — |
| `--text-brand` | Brand-colored headings | "FinTreX Dashboard" |
| `--text-accent` | Gold-accented premium text | "Ultra Member", price highlights |
| `--text-success` | Positive values | "+5.2%", "Profit: ₺12,400" |
| `--text-danger` | Negative values, errors | "-3.1%", "Loss: ₺2,100", validation error |
| `--text-warning` | Warning messages | "Approaching portfolio limit" |
| `--text-info` | Informational labels | "New feature available" |
| `--text-sidebar` | Sidebar default text | Menu item labels |
| `--text-sidebar-hover` | Sidebar hover text | — |
| `--text-sidebar-active` | Active sidebar item | Gold-colored active label |
| `--text-tooltip` | Tooltip text | — |
| `--text-badge` | Badge/chip text | — |
| `--text-placeholder` | Input placeholder text | "Search assets..." |

---

#### 14.1.4 Borders

| Token | Use When |
|---|---|
| `--border-default` | Cards, inputs, table cells, generic dividers |
| `--border-subtle` | Very light separators (e.g., between list items in a dropdown) |
| `--border-strong` | Emphasized borders (table headers, grouped sections) |
| `--border-focus` | Focus ring border color (on input focus) |
| `--border-error` | Validation error state on inputs |
| `--border-success` | Validation success state on inputs |
| `--border-warning` | Warning state border |
| `--border-brand` | Brand-colored border (section highlights, active tabs) |
| `--border-gold` | Premium / accent borders (Ultra badge outline) |
| `--border-sidebar` | Sidebar internal dividers |

---

#### 14.1.5 Interaction States

**Transparent overlays** — apply these on top of any background for state changes:

| Token | Use When |
|---|---|
| `--state-hover` | Generic hover darkening (table rows, list items, clickable areas) |
| `--state-active` | Mouse-down / pressed state |
| `--state-focus-ring` | Focus glow ring (used in `box-shadow`) |
| `--state-selected` | Selected item background (selected table row, chosen option) |
| `--state-disabled` | Overlay on disabled elements |

**Button tokens** — use these for all button styles:

| Variant | Tokens | When to Use |
|---|---|---|
| Primary | `--btn-primary-bg`, `--btn-primary-bg-hover`, `--btn-primary-bg-active`, `--btn-primary-text` | Main CTA: "Create Portfolio", "Save", "Confirm" |
| Secondary | `--btn-secondary-*` | Secondary actions: "Cancel", "Back", "Filter" |
| Accent | `--btn-accent-*` | Premium/highlight actions: "Upgrade to Ultra", "Subscribe" |
| Danger | `--btn-danger-*` | Destructive actions: "Delete Account", "Remove Asset" |
| Ghost | `--btn-ghost-*` | Minimal buttons: icon buttons, tertiary actions |
| Disabled | `--btn-disabled-bg`, `--btn-disabled-text` | Any disabled button state |
---

#### 14.1.6 Chart & Data Visualization

**Market category anchors** (use when the chart specifically shows market type breakdown):

| Token | Market Type |
|---|---|
| `--chart-bist` | BIST (Turkish equities) — Blue |
| `--chart-crypto` | Cryptocurrency — Violet |
| `--chart-precious` | Precious Metals (Gold, Silver) — Amber |

**Extended categorical palette** (use for pie charts, bar charts, line charts with 4+ categories):

| Token | Color | Use in Sequence |
|---|---|---|
| `--chart-1` | Blue | First slice / series |
| `--chart-2` | Red | Second |
| `--chart-3` | Green | Third |
| `--chart-4` | Amber | Fourth |
| `--chart-5` | Violet | Fifth |
| `--chart-6` | Cyan | Sixth |
| `--chart-7` | Rose | Seventh |
| `--chart-8` | Indigo | Eighth |
| `--chart-9` | Emerald | Ninth |
| `--chart-10` | Yellow | Tenth |
| `--chart-11` | Purple | Eleventh |
| `--chart-12` | Sky | Twelfth |
| `--chart-13` | Orange | Thirteenth |
| `--chart-14` | Teal | Fourteenth |
| `--chart-15` | Deep Violet | Fifteenth |

**P&L and chart infrastructure:**

| Token | Purpose |
|---|---|
| `--chart-profit` | Profit line / bar / delta (green) |
| `--chart-loss` | Loss line / bar / delta (red) |
| `--chart-neutral` | Neutral / unchanged indicator |
| `--chart-baseline` | Zero line, grid lines, axis |
| `--chart-bg` | Chart container background |
| `--chart-grid` | Grid lines inside chart area |
| `--chart-axis` | Axis lines |
| `--chart-label` | Axis labels, legend text |
| `--chart-tooltip-bg` | Tooltip background on charts |
| `--chart-tooltip-text` | Tooltip text on charts |

---

#### 14.1.7 Typography

**Font families:**

| Token | Usage |
|---|---|
| `--font-family-sans` | All UI text (headings, body, labels, buttons) |
| `--font-family-mono` | Prices, portfolio values, data tables, code blocks |

**Font sizes:**

| Token | Size | Usage |
|---|---|---|
| `--font-size-2xs` | 10px | Micro labels, legal text |
| `--font-size-xs` | 12px | Captions, badges, timestamps, chart labels |
| `--font-size-sm` | 14px | Secondary body text, table cells, form labels |
| `--font-size-base` | 16px | Primary body text |
| `--font-size-md` | 18px | Lead/intro text, card titles |
| `--font-size-lg` | 20px | Section headings (h3) |
| `--font-size-xl` | 24px | Page sub-headings (h2) |
| `--font-size-2xl` | 30px | Page titles (h1) |
| `--font-size-3xl` | 36px | Hero text, dashboard KPI values |
| `--font-size-4xl` | 48px | Large display numbers |
| `--font-size-5xl` | 60px | Extra large display |

**Font weights:**

| Token | Value | Usage |
|---|---|---|
| `--font-weight-light` | 300 | De-emphasized text, large display numbers |
| `--font-weight-regular` | 400 | Body text |
| `--font-weight-medium` | 500 | Subtle emphasis, form labels, table headers |
| `--font-weight-semibold` | 600 | Card titles, section headings |
| `--font-weight-bold` | 700 | Page titles, strong emphasis, KPI values |

---

#### 14.1.8 Spacing

Based on an **8px grid** with fine 2px and 4px sub-steps for tight UI.

| Token | Value | Common Usage |
|---|---|---|
| `--space-0` | 0px | Reset |
| `--space-px` | 1px | Borders, hairlines |
| `--space-0-5` | 2px | Micro gap (focus ring offset) |
| `--space-1` | 4px | Tiny gap (icon padding, tight inline) |
| `--space-1-5` | 6px | Between icon and text (compact) |
| `--space-2` | 8px | Base unit. Label-to-input gap, inline-icon gap |
| `--space-2-5` | 10px | Slightly wider than base |
| `--space-3` | 12px | Small padding (badges, chips, compact cards) |
| `--space-4` | 16px | Standard padding (inputs, buttons, card inner) |
| `--space-5` | 20px | Card padding, form field group gap |
| `--space-6` | 24px | Section inner padding, page horizontal padding (mobile) |
| `--space-8` | 32px | Gap between page sections |
| `--space-10` | 40px | Page horizontal padding (desktop), large section gap |
| `--space-12` | 48px | Hero section padding |
| `--space-16` | 64px | Major layout spacing |
| `--space-20` | 80px | Page top/bottom margin |
| `--space-24` | 96px | Large layout spacing |
| `--space-32` | 128px | Maximum spacing |

**Semantic spacing aliases** (prefer these for layout):

| Token | Value | Purpose |
|---|---|---|
| `--spacing-page-x` | 24px | Horizontal page padding (mobile) |
| `--spacing-page-x-lg` | 40px | Horizontal page padding (desktop) |
| `--spacing-card-padding` | 20px | Internal card padding |
| `--spacing-section-gap` | 32px | Vertical gap between page sections |
| `--spacing-stack-sm` | 8px | Tight vertical gap (label above input) |
| `--spacing-stack-md` | 16px | Normal vertical gap (between form fields) |
| `--spacing-stack-lg` | 24px | Loose vertical gap (between form groups) |
| `--spacing-inline-sm` | 8px | Tight horizontal gap (icon + text) |
| `--spacing-inline-md` | 12px | Normal horizontal gap |
| `--spacing-inline-lg` | 16px | Loose horizontal gap |

---

#### 14.1.9 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-none` | 0px | No rounding (square) |
| `--radius-xs` | 2px | Subtle rounding (code blocks, small badges) |
| `--radius-sm` | 4px | Tags, chips, small buttons |
| `--radius-md` | 6px | Inputs, dropdowns |
| `--radius-DEFAULT` | 8px | Cards, panels, standard containers |
| `--radius-lg` | 10px | Large cards, modals |
| `--radius-xl` | 12px | Feature cards, popovers |
| `--radius-2xl` | 16px | Marketing sections, hero cards |
| `--radius-3xl` | 24px | Large decorative elements |
| `--radius-full` | 9999px | Pills (tags, badges), avatars, circular buttons |

---

#### 14.1.10 Shadows & Elevation

| Token | Usage |
|---|---|
| `--shadow-none` | Reset / flat element |
| `--shadow-xs` | Barely visible lift (active state feedback) |
| `--shadow-sm` | Default card shadow, subtle elevation |
| `--shadow-md` | Hovered card, slightly raised element |
| `--shadow-lg` | Dropdowns, floating panels, sidebar |
| `--shadow-xl` | Modals, dialogs |
| `--shadow-2xl` | Maximum elevation (toast notifications, command palette) |
| `--shadow-inner` | Inset shadow (pressed button, recessed input) |

**Semantic shadow aliases:**

| Token | Mapped To | Purpose |
|---|---|---|
| `--shadow-card` | shadow-sm | Default card at rest |
| `--shadow-card-hover` | shadow-md | Card on hover |
| `--shadow-dropdown` | shadow-lg | Dropdown menus, select options |
| `--shadow-modal` | shadow-xl | Modal dialogs |
| `--shadow-sidebar` | shadow-lg | Sidebar shadow |
| `--shadow-toast` | shadow-lg | Toast/snackbar notifications |
| `--shadow-input-focus` | 3px ring | Focus glow on inputs |

---

#### 14.1.11 Z-Index

| Token | Value | Usage |
|---|---|---|
| `--z-behind` | -1 | Behind main content (decorative backgrounds) |
| `--z-default` | 0 | Normal document flow |
| `--z-raised` | 1 | Slightly raised (hovering cards, selected items) |
| `--z-dropdown` | 10 | Dropdown menus, select popups |
| `--z-sticky` | 20 | Sticky headers, fixed toolbars |
| `--z-sidebar` | 30 | Sidebar (overlaps content on mobile) |
| `--z-overlay` | 40 | Modal backdrop, drawer overlay |
| `--z-modal` | 50 | Modal dialog content |
| `--z-toast` | 60 | Toast notifications (above modals) |
| `--z-tooltip` | 70 | Tooltips (highest normal layer) |
| `--z-max` | 9999 | Emergency override only |

---

#### 14.1.12 Transitions & Motion

**Durations:**

| Token | Value | Usage |
|---|---|---|
| `--duration-instant` | 50ms | Immediate feedback (checkbox toggle) |
| `--duration-fast` | 150ms | Color changes, border transitions, button states |
| `--duration-normal` | 250ms | Default transition (most UI elements) |
| `--duration-slow` | 400ms | Layout changes, expanding panels |
| `--duration-slower` | 600ms | Page transitions, complex animations |

**Easings:**

| Token | Usage |
|---|---|
| `--ease-default` | Standard ease-in-out for most transitions |
| `--ease-in` | Elements leaving the screen |
| `--ease-out` | Elements entering the screen |
| `--ease-bounce` | Playful micro-interactions (badge count update) |
| `--ease-spring` | Elastic feel (modal entrance) |

**Pre-composed transitions:**

| Token | Usage |
|---|---|
| `--transition-colors` | Color, background-color, border-color changes |
| `--transition-shadow` | Shadow changes (card hover) |
| `--transition-transform` | Scale, translate, rotate changes |
| `--transition-all` | General-purpose (use sparingly — prefer specific) |

---

#### 14.1.13 Breakpoints

These are SCSS variables (not CSS custom properties) used in `@media` queries:

| Variable | Value | Meaning |
|---|---|---|
| `$breakpoint-mobile` | 480px | Small phones |
| `$breakpoint-tablet` | 768px | Tablets, large phones landscape |
| `$breakpoint-desktop` | 1024px | Standard desktop, small laptops |
| `$breakpoint-wide` | 1280px | Wide desktop |
| `$breakpoint-ultra` | 1536px | Ultra-wide monitors |

```scss
// Mobile-first: base = mobile, layer up
.card-grid {
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: $breakpoint-tablet) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: $breakpoint-desktop) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

#### 14.1.14 Quick Decision Cheat Sheet

**"I need a background for..."**
- A page → `--bg-app`
- A card/panel → `--bg-surface`
- A dropdown/popover → `--bg-surface-raised`
- A modal backdrop → `--bg-surface-overlay`
- An input field → `--bg-input`
- A success alert → `--bg-success-subtle`
- A premium feature highlight → `--bg-gold-subtle`

**"I need text color for..."**
- Main content → `--text-primary`
- A description/caption → `--text-secondary`
- A timestamp → `--text-tertiary`
- A positive percentage → `--text-success`
- A negative percentage → `--text-danger`
- A premium label → `--text-accent`
- Text on the sidebar → `--text-sidebar`

**"I need a border for..."**
- A card or input → `--border-default`
- A focused input → `--border-focus`
- A validation error → `--border-error`
- A premium highlight → `--border-gold`

**"I need a shadow for..."**
- A card at rest → `--shadow-card`
- A card on hover → `--shadow-card-hover`
- A dropdown → `--shadow-dropdown`
- A modal → `--shadow-modal`
- An input on focus → `--shadow-input-focus`

**"I need spacing for..."**
- Inside a card → `--spacing-card-padding`
- Between form fields → `--spacing-stack-md`
- Between sections → `--spacing-section-gap`
- Between icon and text → `--spacing-inline-sm`
- Page side padding → `--spacing-page-x` (mobile) / `--spacing-page-x-lg` (desktop)

**"I need a chart color for..."**
- BIST assets → `--chart-bist`
- Crypto assets → `--chart-crypto`
- Precious metals → `--chart-precious`
- Generic 5-category pie chart → `--chart-1` through `--chart-5`
- Profit indicator → `--chart-profit`
- Loss indicator → `--chart-loss`

---

### 14.2 Layout — Proper CSS Techniques Over Magic Numbers

**Always use Flexbox or Grid for layout and alignment.** Never approximate centering or spacing with arbitrary pixel offsets.

```scss
// ❌ WRONG — fake centering with magic numbers
.container {
  padding-top: 47px;
  padding-left: 120px;
  margin-top: -3px;
}

// ✅ CORRECT
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}
```

```scss
// ❌ WRONG — manual sidebar layout with floats
.sidebar { width: 280px; float: left; }
.content { margin-left: 280px; }

// ✅ CORRECT
.layout {
  display: grid;
  grid-template-columns: auto 1fr;
}
```

### 14.3 Specificity — Keep It Low, Keep It Maintainable

```scss
// ❌ WRONG — !important as a band-aid
.button {
  color: red !important;
  margin: 0 !important;
}

// ❌ WRONG — deeply nested selectors that create specificity nightmares
body .app div.container section.main .card .header h2 span {
  color: var(--text-primary);
}

// ✅ CORRECT — flat, low-specificity selectors
.card-header__title {
  color: var(--text-primary);
}
```

**Rules:**
- `!important` is almost always a symptom of a specificity problem. Fix the root cause. The only acceptable use case is in utility classes that are explicitly designed to override.
- Maximum nesting depth: **3 levels.** If you need deeper nesting, refactor your component structure.
- Use BEM-like naming (`block__element--modifier`) or rely on Angular's built-in view encapsulation to avoid class name conflicts.
- Never write global styles that target component internals — use `::ng-deep` only as a last resort, and document why.

### 14.4 Responsive Design

```scss
// ❌ WRONG — unexplained magic breakpoints
@media (max-width: 768px) { ... }

// ✅ CORRECT — semantic, documented breakpoints
@media (max-width: $breakpoint-tablet) { ... }
@media (max-width: $breakpoint-mobile) { ... }
```

- Design **mobile-first**: write base styles for mobile, then layer complexity upward with `min-width` media queries.
- Never use fixed widths on content containers. Use `max-width` with percentage or grid-based layouts.
- All layouts must be functional from 320px to 2560px viewport width.

### 14.5 Theme Support (Dark / Light)

The application supports dark and light themes via CSS custom properties. Component styles must reference tokens only — never hardcode color values. Theme switching changes token values globally.

```scss
// Global theme definition
:root {
  --surface-primary: #ffffff;
  --text-primary: #1a1a1a;
}

[data-theme='dark'] {
  --surface-primary: #1a2332;
  --text-primary: #e8e8e8;
}

// Component SCSS — just reference tokens
.card {
  background: var(--surface-primary);
  color: var(--text-primary);
}
```
---

## PART V — Documentation & Reference

---

## 15. In-Project Documentation

Good architecture is worthless if the next developer (or AI) cannot understand the intent behind it. Documentation lives **inside the codebase**, not in external wikis that go stale.

### 15.1 Feature-Level README

**Every feature folder must contain a `README.md`** that describes the feature's purpose, scope, and internal structure. This file is created when the feature is first set up and updated as the feature evolves.

```
features/dashboard/
├── README.md                    ← required
├── dashboard.routes.ts
├── pages/
├── components/
└── services/
```

**README.md template for features:**
```markdown
# Dashboard Feature

## Purpose
Portfolio management and market data visualization for Standard Users.

## SRS References
- FR7: Create Portfolio and Add Assets
- Related Use Cases: Creating a portfolio, Adding assets, Creating a watchlist

## Routes
| Path | Component | Description |
|---|---|---|
| `/dashboard` | `PortfolioListPage` | Lists all user portfolios |
| `/dashboard/:id` | `PortfolioDetailPage` | Single portfolio with pie chart |
| `/dashboard/watchlist` | `WatchlistPage` | User's tracked assets |
| `/dashboard/market/:symbol` | `MarketDetailPage` | Asset detail with charts |

## Key Components
- `AssetSearchComponent` — searches external API for assets
- `WatchlistTableComponent` — sortable/filterable asset table

## Dependencies
- `core/models/portfolio.model.ts`, `core/models/asset.model.ts`
- `core/interfaces/portfolio.repository.ts`
- `shared/charts/dynamic-pie-chart`
```

### 15.2 Shared & Core Layer Documentation

When `shared/` or `core/` folders grow beyond 5-6 files, add a brief `README.md` to that folder explaining its contents and conventions:

```
shared/components/README.md    — lists available shared components and their @Input/@Output contracts
core/models/README.md          — summarizes all domain models and their relationships
core/interfaces/README.md      — lists all abstract contracts and which data/ class implements each
```

These don't need to be long — a table listing files with one-line descriptions is enough. The goal is discoverability: a new developer (or AI) should be able to scan the README and find what already exists before creating duplicates.

### 15.3 Complex Logic Documentation

For any non-obvious business logic, algorithm, or architectural decision, add a brief inline comment or a `DECISIONS.md` file in the relevant folder:

```ts
// ✅ GOOD — explains the "why", not the "what"
// Default tier users get a random Economist assignment because they
// don't have profile-browsing privileges (BR2). Premium/Ultra users
// select from the pool directly.
if (user.subscriptionTier === SubscriptionTier.DEFAULT) {
  return this.assignRandom(economistPool);
}
```

```
// ❌ BAD — states the obvious
// Check if tier is default
if (user.subscriptionTier === SubscriptionTier.DEFAULT) {
```

**When to create a `DECISIONS.md`:**
- A non-trivial architectural choice was made (e.g., why SignalR over raw WebSocket)
- A workaround was implemented due to a third-party limitation
- A feature deviates from the standard pattern for a specific reason

---

## 16. DO / DON'T Quick Reference

### DON'T

- ❌ Generate `NgModule` — project is 100% Standalone Components
- ❌ Add Angular imports inside `core/models/` or `core/enums/` — they must be pure TypeScript
- ❌ Import `data/` from `presentation/` — violates dependency rule
- ❌ Write class-based guards or interceptors — functional format only
- ❌ Render mutation UI for the Economist role
- ❌ Use `any` — always provide explicit types
- ❌ Hardcode limits, API URLs, or magic numbers
- ❌ Write raw hex/rgb values in component SCSS — use design tokens
- ❌ Use arbitrary pixel offsets for layout — use Flexbox or Grid
- ❌ Use `!important` to fix styling conflicts — fix the root specificity issue
- ❌ Nest SCSS selectors more than 3 levels deep
- ❌ Place feature-specific components in `shared/`
- ❌ Access `window` or `localStorage` directly — wrap in an injectable service
- ❌ Write CSS or LESS — only SCSS
- ❌ Eagerly load feature routes — every feature must be lazy-loaded
- ❌ Define page-level routes in `app.routes.ts` — each feature owns its routes in its own `*.routes.ts` file
- ❌ Nest Observable subscriptions — use RxJS operators
- ❌ Leave HTTP calls without error handling
- ❌ Use inline object shapes for domain entities or cross-feature API responses — create a model in `core/models/`
- ❌ Import between feature modules — go through `shared/` or `core/`
- ❌ Create Angular artifacts (components, services, pipes, guards) by manually creating files — always use `ng generate`
- ❌ Use `--skip-tests` when generating — every artifact must have a `.spec.ts` file
- ❌ Create deep inheritance hierarchies — prefer composition
- ❌ Add a new feature folder without a `README.md` inside it

### DO

- ✅ Add `standalone: true` to every component, pipe, and directive
- ✅ Create models in `core/models/` as `kebab-case.model.ts`
- ✅ For service contracts: abstract class in `core/interfaces/`, implementation in `data/`
- ✅ Use `UserRole` enum for role checks — never compare against string literals
- ✅ Use `SubscriptionTier` enum for tier checks
- ✅ Return `Observable` from all HTTP methods
- ✅ Use `catchError` for error handling in services
- ✅ Prefix component selectors with `app-`
- ✅ Split growing features into `pages/`, `components/`, `services/` subfolders
- ✅ Add new routes to the respective `*.routes.ts` file
- ✅ Use CSS custom properties (design tokens) for all visual values
- ✅ Use Flexbox or Grid for all layout and alignment
- ✅ Write mobile-first responsive styles with semantic breakpoints
- ✅ Keep SCSS specificity low and selectors flat
- ✅ Unsubscribe from Observables (`takeUntilDestroyed()`, `async` pipe, or `DestroyRef`)
- ✅ Follow SOLID — especially SRP for components and services
- ✅ Use `ng generate` with correct path and flags (`--standalone`, `--functional`) for all Angular artifacts
- ✅ Create a `README.md` in every feature folder documenting purpose, routes, and key components
- ✅ Add inline comments that explain "why", not "what", for non-obvious business logic
- ✅ Create a model in `core/models/` for domain entities and shared API shapes; keep small local types inside their feature