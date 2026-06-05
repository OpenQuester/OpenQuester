/**
 * Dependency Injection Tokens for tsyringe.
 *
 * These symbols are project-wide composition identifiers, not a layer-specific
 * dependency. Keep them free of application, domain, infrastructure, or
 * presentation imports.
 */
export const DI_TOKENS = {
  Database: Symbol.for("Database"),
  Redis: Symbol.for("Redis"),
  Logger: Symbol.for("Logger"),
  Environment: Symbol.for("Environment"),
  TypeORMUserRepository: Symbol.for("TypeORMUserRepository"),
  TypeORMFileRepository: Symbol.for("TypeORMFileRepository"),
  TypeORMFileUsageRepository: Symbol.for("TypeORMFileUsageRepository"),
  TypeORMPermissionRepository: Symbol.for("TypeORMPermissionRepository"),
  TypeORMPackageRepository: Symbol.for("TypeORMPackageRepository"),
  TypeORMPackageTagRepository: Symbol.for("TypeORMPackageTagRepository"),
  TypeORMGameStatisticsRepository: Symbol.for("TypeORMGameStatisticsRepository"),
  TypeORMPlayerGameStatsRepository: Symbol.for("TypeORMPlayerGameStatsRepository"),
  S3Context: Symbol.for("S3Context"),
  GameIndexManager: Symbol.for("GameIndexManager"),
  RedisExpirationHandlers: Symbol.for("RedisExpirationHandlers"),
  Cache: Symbol.for("ICache"),
  RealtimeGateway: Symbol.for("RealtimeGateway"),
  LogFileReader: Symbol.for("LogFileReader"),
  LogArchiveStore: Symbol.for("LogArchiveStore"),
  MetricsWriter: Symbol.for("MetricsWriter"),
  ObjectStorage: Symbol.for("ObjectStorage")
} as const;
