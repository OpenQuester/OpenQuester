export enum Permissions {
  ADMIN_PANEL_ACCESS = "admin_panel_access",
  VIEW_SYSTEM_HEALTH = "view_system_health",
  VIEW_USERS_INFO = "view_users_info",
  BAN_USERS = "ban_users",
  DELETE_ANOTHER_USER = "delete_another_user",
}

export type PermissionKey = keyof typeof Permissions;
export type PermissionValue = (typeof Permissions)[PermissionKey];
