# Admin Panel

The admin panel is now integrated into the Flutter client application, providing a unified experience across all platforms.

## Features

- **Dashboard Overview**: View statistics including total users, active users, deleted users, and recent registrations
- **User Management**: List, ban, unban, delete, and restore users
- **System Health Monitoring**: Monitor Redis status, server uptime, memory usage, and event loop lag
- **Permission-based Access**: All features are protected by appropriate permissions

## Permissions

The following permissions control access to admin features:

- `admin_panel_access` - Required to access the admin dashboard
- `view_users_info` - Required to view the users list
- `ban_users` - Required to ban/unban users
- `delete_another_user` - Required to delete/restore users
- `view_system_health` - Required to view system health metrics

## Setup

### Prerequisites

1. Flutter SDK installed
2. All dependencies installed (`flutter pub get` in the client directory)

### Building the Project

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Generate the API client from the OpenAPI schema:
   ```bash
   make gen_api
   ```

3. Generate all necessary files:
   ```bash
   make pre_build
   ```

4. Run the application:
   ```bash
   flutter run
   ```

## Architecture

The admin panel follows the project's feature-based architecture:

```
lib/src/features/admin/
├── controller/
│   └── admin_controller.dart    # Business logic and API calls
├── view/
│   ├── admin_dashboard_screen.dart  # Main dashboard with tabs
│   └── admin_dashboard_button.dart  # Button to access dashboard
└── admin.dart                    # Feature exports
```

### AdminController

The `AdminController` manages all admin-related state and operations:

- `loadDashboardData()` - Fetches dashboard statistics
- `loadUsersList()` - Fetches paginated user list
- `loadSystemHealth()` - Fetches system health metrics
- `loadPing()` - Performs health check ping
- `banUser()` / `unbanUser()` - Manage user bans
- `deleteUser()` / `restoreUser()` - Manage user deletion/restoration

### AdminDashboardScreen

The main dashboard screen includes three tabs:

1. **Overview Tab** - Shows statistics, system health summary, and recent users
2. **Users Tab** - Lists all users with management actions
3. **System Health Tab** - Displays detailed system metrics

## API Endpoints

All admin endpoints are under `/v1/admin/api/`:

- `GET /dashboard` - Get dashboard data
- `GET /users` - Get paginated user list
- `GET /system/health` - Get system health metrics
- `GET /system/ping` - Ping system for health check
- `POST /users/:id/ban` - Ban a user
- `POST /users/:id/unban` - Unban a user
- `DELETE /users/:id` - Delete a user
- `POST /users/restore/:id` - Restore a deleted user

## Localization

All admin panel text is localized. Keys are under the `admin` namespace in `assets/localization/en-US.json`.

## Extending the Admin Panel

To add new features to the admin panel:

1. Add new endpoints to `openapi/schema.json`
2. Regenerate the API client: `make gen_api`
3. Add new methods to `AdminController`
4. Create UI components in the `view/` directory
5. Add localization keys to `assets/localization/en-US.json`
6. Update permissions in server's `Permissions` enum if needed

## Security

- All admin endpoints require authentication
- Permission checks are enforced on both frontend and backend
- Sensitive actions (delete, ban) require user confirmation
- All admin actions are logged for audit purposes
