// Centralized React Query keys to avoid typos and enable refactors
export enum QueryKeys {
  DASHBOARD = "admin-dashboard",
  SYSTEM_HEALTH = "admin-system-health",
  PING = "admin-ping",
  USERS = "admin-users",
  PACKAGES = "admin-packages",
  CURRENT_USER = "current-user",
}

export type QueryKeyName = keyof typeof QueryKeys;
