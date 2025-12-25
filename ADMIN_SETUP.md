# Admin Panel Setup Guide

This guide provides step-by-step instructions for setting up and using the new Flutter-based admin panel.

## Prerequisites

Before you begin, ensure you have the following installed:

- Flutter SDK (latest stable version)
- Dart SDK (comes with Flutter)
- All project dependencies

## Initial Setup

### 1. Install Dependencies

Navigate to the client directory and install dependencies:

```bash
cd client
flutter pub get
```

### 2. Generate API Client

The admin panel requires the API client to be generated from the OpenAPI schema. This step is **crucial** and must be completed before running the application.

```bash
cd client
make gen_api
```

This command will:
- Read the OpenAPI schema from `openapi/schema.json`
- Generate Dart API client code in `client/packages/openapi/lib/src/`
- Include all admin endpoints

### 3. Generate Required Files

Generate all necessary build files:

```bash
cd client
make pre_build
```

This will:
- Generate API client
- Build all packages
- Run code generation (build_runner)
- Generate localization files
- Generate worker files
- Create index files

## Running the Application

### Development Mode

```bash
cd client
flutter run
```

Select your target device when prompted.

### Production Build

For web:
```bash
cd client
flutter build web
```

For desktop (Windows, macOS, Linux):
```bash
cd client
flutter build windows  # or macos, linux
```

For mobile (Android, iOS):
```bash
cd client
flutter build apk      # Android
flutter build ios      # iOS (requires macOS)
```

## Accessing the Admin Panel

### 1. User Permissions

To access the admin panel, your user account must have the `admin_panel_access` permission. Additional permissions control access to specific features:

- `admin_panel_access` - Required to see the admin dashboard button and access the panel
- `view_users_info` - Required to view the users tab
- `ban_users` - Required to ban/unban users
- `delete_another_user` - Required to delete/restore users
- `view_system_health` - Required to view system health metrics

### 2. Granting Admin Permissions

Permissions are managed on the backend. To grant admin access to a user:

1. Connect to your database
2. Update the user's permissions in the `users` table
3. Add the required permissions to the user's `permissions` array

Example SQL (PostgreSQL):
```sql
UPDATE users 
SET permissions = ARRAY['admin_panel_access', 'view_users_info', 'view_system_health', 'ban_users', 'delete_another_user']::permissions[]
WHERE id = YOUR_USER_ID;
```

### 3. Accessing the Dashboard

Once permissions are granted:

1. Log in to the application
2. You will see an "Admin Dashboard" button on the home screen
   - On mobile: In the floating action buttons
   - On desktop: In the left sidebar
3. Click the button to open the admin dashboard

## Admin Panel Features

### Overview Tab

Displays:
- Total users count
- Active users count
- Deleted users count
- Recent user registrations
- System health summary (Redis status, uptime, Redis keys)

### Users Tab

Features:
- Paginated user list
- User statistics (total, active, banned, deleted)
- User actions (ban, unban, delete, restore)
- User information display (ID, username, email, status)
- Confirmation dialogs for sensitive actions

### System Health Tab

Displays:
- Ping status with event loop lag
- Redis connection status and response time
- Redis memory usage
- Server uptime
- Server memory usage (used/total)

## Development

### Project Structure

```
client/lib/src/features/admin/
├── controller/
│   └── admin_controller.dart           # Business logic
├── view/
│   ├── admin_dashboard_screen.dart     # Main dashboard
│   └── admin_dashboard_button.dart     # Home screen button
├── admin.dart                           # Feature exports
└── README.md                            # Feature documentation
```

### Adding New Admin Features

1. **Backend**: Add new endpoints to `server/src/presentation/controllers/rest/AdminRestApiController.ts`
2. **Schema**: Add endpoint definitions to `openapi/schema.json`
3. **Generate API**: Run `make gen_api` in the client directory
4. **Controller**: Add methods to `AdminController`
5. **UI**: Create widgets in the `view/` directory
6. **Localization**: Add strings to `client/assets/localization/en-US.json`
7. **Test**: Test the new features thoroughly

### Code Style

Follow the project's Flutter/Dart coding standards:
- Use `WatchingWidget` for reactive UI
- Implement permission checks in the controller
- Add loading states and error handling
- Use localization for all user-facing text
- Follow the existing naming conventions

## Troubleshooting

### API Client Not Generated

**Problem**: Errors about missing admin API methods.

**Solution**: 
```bash
cd client
make gen_api
```

### Permission Denied

**Problem**: Can't access admin panel or see the button.

**Solution**: Verify your user has the `admin_panel_access` permission in the database.

### Build Errors

**Problem**: Build fails with missing dependencies.

**Solution**: 
```bash
cd client
flutter clean
flutter pub get
make pre_build
```

### Localization Keys Not Found

**Problem**: Text displays as "admin.dashboard" instead of "Admin Dashboard".

**Solution**: 
```bash
cd client
make gen_locale
```

## API Endpoints

All admin endpoints are prefixed with `/v1/admin/api/`:

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/dashboard` | Get dashboard statistics | `admin_panel_access` |
| GET | `/users` | Get paginated user list | `view_users_info` |
| GET | `/system/health` | Get system health metrics | `view_system_health` |
| GET | `/system/ping` | Ping system for health check | `view_system_health` |
| POST | `/users/:id/ban` | Ban a user | `ban_users` |
| POST | `/users/:id/unban` | Unban a user | `ban_users` |
| DELETE | `/users/:id` | Delete a user | `delete_another_user` |
| POST | `/users/restore/:id` | Restore a deleted user | `delete_another_user` |

## Security Considerations

- All admin endpoints require authentication
- Permission checks are enforced on both frontend and backend
- Sensitive actions require user confirmation
- All admin actions are logged for audit purposes
- The admin button is hidden from users without permissions

## Contributing

When contributing to the admin panel:

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include permission checks
4. Write meaningful commit messages
5. Test all changes thoroughly
6. Update documentation as needed

## Support

For issues or questions:
- Create an issue on GitHub
- Check existing documentation in `client/lib/src/features/admin/README.md`
- Review the frontend coding standards in `.github/instructions/frontend.instructions.md`
