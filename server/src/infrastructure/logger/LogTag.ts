/**
 * Predefined log tags for categorization and filtering.
 * Tags help identify the subsystem/context of a log entry.
 */
export enum LogTag {
  /** REST API requests */
  HTTP = "http",
  /** WebSocket events */
  SOCKET = "socket",
  /** Game state changes and actions */
  GAME = "game",
  /** Authentication/authorization */
  AUTH = "auth",
  /** Admin panel operations */
  ADMIN = "admin",
  /** Timer-related operations */
  TIMER = "timer",
  /** Action queue operations */
  QUEUE = "queue",
  /** Media upload/download */
  MEDIA = "media",
  /** Database operations */
  DB = "db",
  /** Redis operations */
  REDIS = "redis",
  /** Scheduled jobs */
  CRON = "cron",
}
