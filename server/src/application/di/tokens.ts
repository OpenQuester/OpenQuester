/**
 * Dependency Injection Tokens for tsyringe.
 *
 * WHEN TO USE @inject():
 * - Use @inject(DI_TOKENS.X) for dependencies registered with symbol tokens
 *   (external libraries, interfaces, runtime values like Logger, Redis, IO)
 *
 * WHEN NOT TO USE @inject():
 * - Concrete classes with @singleton() decorator are auto-resolved by type
 *   (e.g., GameService, UserRepository - just list them in constructor)
 *
 * Example:
 * ```typescript
 * @singleton()
 * class MyService {
 *   constructor(
 *     @inject(DI_TOKENS.Logger) private logger: ILogger,  // Token-registered
 *     private gameService: GameService,                    // Auto-resolved
 *   ) {}
 * }
 * ```
 */

/**
 * DI tokens for external/runtime dependencies.
 * These are registered manually during app bootstrap.
 */
export const DI_TOKENS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE - External library instances
  // ═══════════════════════════════════════════════════════════════════════════

  /** Database connection (TypeORM DataSource wrapper) */
  Database: Symbol.for("Database"),

  /** Redis client (ioredis) */
  Redis: Symbol.for("Redis"),

  /** Socket.IO server instance */
  IO: Symbol.for("IO"),

  /** Socket.IO game namespace */
  IOGameNamespace: Symbol.for("IOGameNamespace"),

  /** Application logger (pino-based) */
  Logger: Symbol.for("Logger"),

  /** Environment configuration */
  Environment: Symbol.for("Environment"),

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPEORM REPOSITORIES - Created from Database.getRepository()
  // ═══════════════════════════════════════════════════════════════════════════

  /** TypeORM Repository<User> */
  TypeORMUserRepository: Symbol.for("TypeORMUserRepository"),

  /** TypeORM Repository<File> */
  TypeORMFileRepository: Symbol.for("TypeORMFileRepository"),

  /** TypeORM Repository<FileUsage> */
  TypeORMFileUsageRepository: Symbol.for("TypeORMFileUsageRepository"),

  /** TypeORM Repository<Permission> */
  TypeORMPermissionRepository: Symbol.for("TypeORMPermissionRepository"),

  /** TypeORM Repository<Package> */
  TypeORMPackageRepository: Symbol.for("TypeORMPackageRepository"),

  /** TypeORM Repository<PackageTag> */
  TypeORMPackageTagRepository: Symbol.for("TypeORMPackageTagRepository"),

  /** TypeORM Repository<GameStatistics> */
  TypeORMGameStatisticsRepository: Symbol.for(
    "TypeORMGameStatisticsRepository"
  ),

  /** TypeORM Repository<PlayerGameStats> */
  TypeORMPlayerGameStatsRepository: Symbol.for(
    "TypeORMPlayerGameStatsRepository"
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIAL DEPENDENCIES - Runtime-created or late-bound
  // ═══════════════════════════════════════════════════════════════════════════

  /** S3 storage context (created from Environment) */
  S3Context: Symbol.for("S3Context"),

  /** Game index manager (created during bootstrap) */
  GameIndexManager: Symbol.for("GameIndexManager"),

  /** Redis expiration handlers array */
  RedisExpirationHandlers: Symbol.for("RedisExpirationHandlers"),

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERFACE TOKENS - For SOLID DIP compliance (interface injection)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cache interface (ICache) - implemented by RedisCache.
   * Use @inject(DI_TOKENS.Cache) to inject the cache abstraction.
   */
  Cache: Symbol.for("ICache"),

  /**
   * Game lobby leaver interface (IGameLobbyLeaver) - implemented by SocketIOGameService.
   * Used to break circular dependency: UserService -> IGameLobbyLeaver <- SocketIOGameService.
   * This allows UserService to force users out of games on ban/delete without depending
   * directly on SocketIOGameService.
   */
  GameLobbyLeaver: Symbol.for("IGameLobbyLeaver"),
} as const;
