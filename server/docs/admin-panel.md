# Admin Panel REST API Reference

Legend:

- All endpoints require authentication
- Base path: `/v1/admin/api`
- Response format: JSON
- Error responses include `{ message: string }` payload

Common payload shapes (backend types):

- `UserDTO`: Standard user object with `{ id, username, avatarUrl, createdAt, deletedAt, banned, ... }`
- `PaginatedResult<T>`: `{ data: T, pageInfo: { total } }`

---

## Quick lookup (jump table)

Click an endpoint to jump to its section.

| Area   | Endpoint                                        | Method | Permission                    |
| ------ | ----------------------------------------------- | ------ | ----------------------------- |
| Admin  | [`/dashboard`](#dashboard)                      | GET    | ADMIN_PANEL_ACCESS            |
| Users  | [`/users`](#users)                              | GET    | VIEW_USERS_INFO               |
| Users  | [`/users/:id/ban`](#usersidban)                 | POST   | BAN_USERS                     |
| Users  | [`/users/:id/unban`](#usersidunban)             | POST   | BAN_USERS                     |
| Users  | [`/users/:id`](#usersid)                        | DELETE | DELETE_ANOTHER_USER           |
| Users  | [`/users/restore/:id`](#usersrestoreid)         | POST   | DELETE_ANOTHER_USER           |
| System | [`/system/health`](#systemhealth)               | GET    | VIEW_SYSTEM_HEALTH            |
| System | [`/system/ping`](#systemping)                   | GET    | VIEW_SYSTEM_HEALTH            |

---

## Admin Dashboard

### `/dashboard`

- Method: **GET**
- Permission: **ADMIN_PANEL_ACCESS**
- Query parameters:
  - `timeframe` (optional): Number of days for timeframe filter (e.g., `?timeframe=30`)
- Response: `AdminDashboardData` = `{ totalUsers, activeUsers, deletedUsers, guestsUsers, recentUsers, systemHealth }`

Provides comprehensive overview of system statistics including user counts, recent users, and basic system health metrics.

---

## User Management

### `/users`

- Method: **GET**
- Permission: **VIEW_USERS_INFO**
- Query parameters:
  - `limit` (optional): Results per page (default: 10, max: 100)
  - `offset` (optional): Number of records to skip (default: 0)
  - `search` (optional): Search by username or email
  - `status` (optional): Filter by user status (`active`, `banned`, `deleted`)
  - `userType` (optional): Filter by user type (`guest`, `registered`)
  - `sortBy` (optional): Sort field (e.g., `id`, `created_at`, `username`)
  - `order` (optional): Sort order (`asc` or `desc`)
- Response: `AdminUserListData` = `{ data: UserDTO[], page, perPage, stats: UsersStats }`

Returns paginated list of users with filtering options and aggregated statistics about total/active/deleted/banned/guest users.

### `/users/:id/ban`

- Method: **POST**
- Permission: **BAN_USERS**
- URL parameters:
  - `id`: User ID to ban
- Response: `{ userId: number, isBanned: true }`

Bans a user by ID, preventing them from accessing the platform.

### `/users/:id/unban`

- Method: **POST**
- Permission: **BAN_USERS**
- URL parameters:
  - `id`: User ID to unban
- Response: `{ userId: number, isBanned: false }`

Removes ban from a user by ID, restoring their access to the platform.

### `/users/:id`

- Method: **DELETE**
- Permission: **DELETE_ANOTHER_USER**
- URL parameters:
  - `id`: User ID to delete
- Response: HTTP 204 No Content

Soft-deletes a user by ID (sets `deletedAt` timestamp, user can be restored later).

### `/users/restore/:id`

- Method: **POST**
- Permission: **DELETE_ANOTHER_USER**
- URL parameters:
  - `id`: User ID to restore
- Response: `{ userId: number, restored: true }`

Restores a previously deleted user by ID (clears `deletedAt` timestamp).

---

## System Health

### `/system/health`

- Method: **GET**
- Permission: **VIEW_SYSTEM_HEALTH**
- Response: `AdminSystemHealthData` = `{ redis: { connected, keys, estimatedMemoryBytes, estimatedMemoryMB, averageKeySizeKB }, server: { uptime, memory: { used, total } }, timestamp }`

Provides detailed system health information including Redis metrics (connection status, key count, memory usage) and server metrics (uptime, memory usage).

### `/system/ping`

- Method: **GET**
- Permission: **VIEW_SYSTEM_HEALTH**
- Response: `AdminPingData` = `{ ok: boolean, eventLoopLagMs: number, redis: { connected, responseMs }, timestamp }`

Lightweight health check endpoint measuring event loop lag and Redis response time for monitoring purposes.
