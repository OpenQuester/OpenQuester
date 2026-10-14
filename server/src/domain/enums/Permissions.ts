export enum Permissions {
  // User related
  GET_ALL_USERS = "get_all_users",
  GET_ANOTHER_USER = "get_another_user",
  CHANGE_ANOTHER_USER = "change_another_user",
  DELETE_ANOTHER_USER = "delete_another_user",

  // File related
  DELETE_FILE = "delete_file",

  // Package related
  DELETE_PACKAGE = "delete_package",
  EDIT_PACKAGE = "edit_package",

  // Permission management
  MANAGE_PERMISSIONS = "manage_permissions",

  // Admin panel related
  ADMIN_PANEL_ACCESS = "admin_panel_access",
  VIEW_SYSTEM_HEALTH = "view_system_health",
  VIEW_USERS_INFO = "view_users_info",
  BAN_USERS = "ban_users",
  MUTE_PLAYER = "mute_player",

  // Game moderation: list every game (private included), kick, pause, close
  MANAGE_GAMES = "manage_games",

  // Logging
  VIEW_SYSTEM_LOGS = "view_system_logs",
}
