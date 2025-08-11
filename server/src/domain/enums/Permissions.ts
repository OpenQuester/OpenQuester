export enum Permissions {
  // User related
  GET_ALL_USERS = "get_all_users",
  GET_ANOTHER_USER = "get_another_user",
  CHANGE_ANOTHER_USER = "change_another_user",
  DELETE_ANOTHER_USER = "delete_another_user",

  // File related
  DELETE_FILE = "delete_file",

  // Admin panel related
  ADMIN_PANEL_ACCESS = "admin_panel_access",
  VIEW_SYSTEM_HEALTH = "view_system_health",
  VIEW_USERS_INFO = "view_users_info",
  BAN_USERS = "ban_users",
}
