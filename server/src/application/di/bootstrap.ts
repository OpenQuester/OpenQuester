/**
 * Dependency Injection Container Bootstrap
 *
 * This file initializes the tsyringe container with all dependencies.
 * Call `bootstrapContainer()` during app startup before resolving any services.
 *
 * Architecture:
 * - External deps (Redis, IO, DB) are registered with tokens
 * - Services use @singleton() decorator for automatic resolution
 * - TypeORM repositories are registered during bootstrap
 */

import "reflect-metadata";

import Redis from "ioredis";
import { Server as IOServer, Namespace } from "socket.io";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import {
  ActionHandlerConfigDeps,
  configureActionHandlers,
} from "application/config/ActionHandlerConfig";
import { StorageContextBuilder } from "application/context/storage/StorageContextBuilder";
import { DI_TOKENS } from "application/di/tokens";
import { CronJobFactory } from "application/factories/CronJobFactory";
import { GameExpirationHandler } from "application/handlers/GameExpirationHandler";
import { TimerExpirationHandler } from "application/handlers/TimerExpirationHandler";
import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { TranslateService } from "application/services/text/TranslateService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { createPhaseTransitionRouter } from "domain/state-machine/createPhaseTransitionRouter";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { RedisCache } from "infrastructure/cache/RedisCache";
import { Environment } from "infrastructure/config/Environment";
import { Database } from "infrastructure/database/Database";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import { File } from "infrastructure/database/models/File";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { Permission } from "infrastructure/database/models/Permission";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Context required for DI container initialization.
 * These are external dependencies created during app startup.
 */
export interface DIBootstrapContext {
  /** TypeORM Database wrapper */
  db: Database;
  /** ioredis client */
  redisClient: Redis;
  /** Socket.IO server */
  io: IOServer;
  /** Environment configuration */
  env: Environment;
  /** Application logger */
  logger: ILogger;
}

/**
 * Initializes the DI container with all dependencies.
 *
 * IMPORTANT: Call this ONCE during app startup, BEFORE resolving any services.
 *
 * @param context - External dependencies created during app bootstrap
 */
export async function bootstrapContainer(
  context: DIBootstrapContext
): Promise<void> {
  const { db, redisClient, io, env, logger } = context;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Register infrastructure dependencies (external libraries)
  // ═══════════════════════════════════════════════════════════════════════════

  // Core infrastructure
  container.registerInstance(DI_TOKENS.Database, db);
  container.registerInstance(DI_TOKENS.Redis, redisClient);
  container.registerInstance(DI_TOKENS.IO, io);
  container.registerInstance(DI_TOKENS.Logger, logger);
  container.registerInstance(DI_TOKENS.Environment, env);

  // Socket.IO game namespace (frequently used)
  const gameNamespace: Namespace = io.of(SOCKET_GAME_NAMESPACE);
  container.registerInstance(DI_TOKENS.IOGameNamespace, gameNamespace);

  // S3 storage context
  const s3Context = StorageContextBuilder.buildS3Context(env);
  container.registerInstance(DI_TOKENS.S3Context, s3Context);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Register TypeORM repositories
  // ═══════════════════════════════════════════════════════════════════════════

  container.registerInstance<Repository<User>>(
    DI_TOKENS.TypeORMUserRepository,
    db.getRepository(User)
  );
  container.registerInstance<Repository<File>>(
    DI_TOKENS.TypeORMFileRepository,
    db.getRepository(File)
  );
  container.registerInstance<Repository<FileUsage>>(
    DI_TOKENS.TypeORMFileUsageRepository,
    db.getRepository(FileUsage)
  );
  container.registerInstance<Repository<Permission>>(
    DI_TOKENS.TypeORMPermissionRepository,
    db.getRepository(Permission)
  );
  container.registerInstance<Repository<Package>>(
    DI_TOKENS.TypeORMPackageRepository,
    db.getRepository(Package)
  );
  container.registerInstance<Repository<PackageTag>>(
    DI_TOKENS.TypeORMPackageTagRepository,
    db.getRepository(PackageTag)
  );
  container.registerInstance<Repository<GameStatistics>>(
    DI_TOKENS.TypeORMGameStatisticsRepository,
    db.getRepository(GameStatistics)
  );
  container.registerInstance<Repository<PlayerGameStats>>(
    DI_TOKENS.TypeORMPlayerGameStatsRepository,
    db.getRepository(PlayerGameStats)
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2.5: Register interface implementations for SOLID DIP compliance
  // ═══════════════════════════════════════════════════════════════════════════
  // These allow injecting interfaces rather than concrete classes.
  // Use @inject(DI_TOKENS.X) in constructor for interface injection.

  // ICache -> RedisCache
  // Note: RedisCache has @singleton() so we use the same instance
  container.register(DI_TOKENS.Cache, { useToken: RedisCache });

  // IGameLobbyLeaver -> SocketIOGameService (registered later, uses delay pattern)
  // This registration is deferred - the actual wiring happens in STEP 6
  // via setter injection: userService.setGameLobbyLeaver(socketIOGameService)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Register runtime-created managers
  // ═══════════════════════════════════════════════════════════════════════════

  // GameIndexManager needs RedisService, which is auto-resolved
  const redisService = container.resolve(RedisService);
  const gameIndexManager = new GameIndexManager(redisService, logger);
  container.registerInstance(DI_TOKENS.GameIndexManager, gameIndexManager);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Register special services that need factory creation
  // ═══════════════════════════════════════════════════════════════════════════

  // PhaseTransitionRouter - uses factory function to create handlers
  const gameService = container.resolve(GameService);
  const socketQuestionStateService = container.resolve(
    SocketQuestionStateService
  );
  const roundHandlerFactory = container.resolve(RoundHandlerFactory);

  const phaseTransitionRouter = createPhaseTransitionRouter(
    gameService,
    socketQuestionStateService,
    roundHandlerFactory,
    logger
  );
  container.registerInstance(PhaseTransitionRouter, phaseTransitionRouter);

  // CronSchedulerService - needs array of cron jobs
  const cronJobFactory = container.resolve(CronJobFactory);
  const cronJobs = cronJobFactory.createAllCronJobs();
  const cronSchedulerService = new CronSchedulerService(
    cronJobs,
    redisService,
    logger
  );
  container.registerInstance(CronSchedulerService, cronSchedulerService);

  // Redis expiration handlers - array of handlers for Redis keyspace notifications
  // Note: These handlers are auto-resolved (proper DI) rather than manually instantiated
  const timerExpirationHandler = container.resolve(TimerExpirationHandler);
  const gameExpirationHandler = container.resolve(GameExpirationHandler);
  container.registerInstance(DI_TOKENS.RedisExpirationHandlers, [
    timerExpirationHandler,
    gameExpirationHandler,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Configure action handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const actionRegistry = container.resolve(GameActionHandlerRegistry);
  const socketIOGameService = container.resolve(SocketIOGameService);
  const userService = container.resolve(UserService);

  // Resolve all dependencies needed for action handlers
  const actionHandlerDeps: ActionHandlerConfigDeps = {
    registry: actionRegistry,
    finalRoundService: container.resolve(FinalRoundService),
    socketIOGameService,
    socketIOChatService: container.resolve(SocketIOChatService),
    socketIOQuestionService: container.resolve(SocketIOQuestionService),
    socketGameContextService: container.resolve(SocketGameContextService),
    userService,
    gameProgressionCoordinator: container.resolve(GameProgressionCoordinator),
    gameStatisticsCollectorService: container.resolve(
      GameStatisticsCollectorService
    ),
    gameService,
    timerExpirationService: container.resolve(TimerExpirationService),
    logger,
  };
  configureActionHandlers(actionHandlerDeps);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Post-initialization setup
  // ═══════════════════════════════════════════════════════════════════════════

  // Initialize static TranslateService with logger
  TranslateService.setLogger(logger);
  await TranslateService.initialize();

  // GameActionBroadcastService needs init with IO namespace and game service
  const broadcastService = container.resolve(GameActionBroadcastService);
  broadcastService.init(gameNamespace, socketIOGameService);

  // Wire UserService.setGameLobbyLeaver to break circular dependency
  // SocketIOGameService implements IGameLobbyLeaver interface
  userService.setGameLobbyLeaver(socketIOGameService);
}

/**
 * Export the container for advanced use cases.
 * Prefer using resolve() helpers in most cases.
 */
export { container };
