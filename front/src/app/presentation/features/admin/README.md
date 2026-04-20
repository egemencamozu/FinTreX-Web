# Admin Feature

## Purpose
Admin panel pages for user and platform management workflows.

## Routes
| Path | Component | Description |
|---|---|---|
| `/app/admin/users` | `AdminUsersPage` | User list, role visibility, activate/deactivate actions |
| `/app/admin/economists` | `Economists` | Economist management area |
| `/app/admin/subscriptions` | `AdminSubscriptionsPage` | Subscription plans and limits management |
| `/app/admin/applications` | `Applications` | Economist application review |
| `/app/admin/settings` | `Settings` | Admin configuration page |
| `/app/admin/audit` | `Audit` | Audit and operational visibility |

## Key Components
- `UserManagementPageComponent` (`admin-users.page.ts`): smart container for API orchestration, signals state, and filters.
- `UserTableComponent`: dumb table renderer for users with output events (`roleChange`, `deactivateUser`, `activateUser`).
- `AdminSubscriptionsPage`: editable plan matrix and pricing controls.

## Dependencies
- `core/interfaces/user-management.repository.ts`
- `core/interfaces/subscription.repository.ts`
- `core/enums/user-role.enum.ts`
- `data/repositories/user-management-api.repository.ts`
