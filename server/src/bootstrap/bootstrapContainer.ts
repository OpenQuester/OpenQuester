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

import type Redis from "ioredis";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import {
  ActionHandlerConfigDeps,
  configureActionHandlers
} from "application/config/ActionHandlerConfig";
import { StorageContextBuilder } from "application/context/storage/StorageContextBuilder";
import { DI_TOKENS } from "shared/di/tokens";
import { CronJobFactory } from "application/factories/CronJobFactory";
import { GameExpirationHandler } from "application/handlers/GameExpirationHandler";
import { GameExpirationNotificationHandler } from "application/handlers/GameExpirationNotificationHandler";
import { TimerExpirationHandler } from "application/handlers/TimerExpirationHandler";
import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { StakeQuestionService } from "application/services/question/StakeQuestionService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { TranslateService } from "domain/utils/TranslateService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { createPhaseTransitionRouter } from "domain/state-machine/createPhaseTransitionRouter";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { RedisCache } from "infrastructure/cache/RedisCache";
import { Environment } from "shared/config/Environment";
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
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { FileSystemLogArchiveStore } from "infrastructure/logging/FileSystemLogArchiveStore";
import { FileSystemLogFileReader } from "infrastructure/logging/FileSystemLogFileReader";
import { InfluxDBMetricsWriter } from "infrastructure/metrics/InfluxDBMetricsWriter";
import { S3ObjectStorage } from "infrastructure/storage/S3ObjectStorage";
import { ILogger } from "shared/logging/ILogger";
import { RedisService } from "application/services/redis/RedisService";

/**
 * Context required for DI container initialization.
 * These are external dependencies created during app startup.
 */
interface DIBootstrapContext {
  /** TypeORM Database wrapper */
  db: Database;
  /** ioredis client */
  redisClient: Redis;
  /** Socket.IO server */
  io: IOServer;
  /** Transport-agnostic realtime gateway */
  realtimeGateway: RealtimeGateway;
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
export async function bootstrapContainer(context: DIBootstrapContext): Promise<void> {
  const { db, redisClient, realtimeGateway, env, logger } = context;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Register infrastructure dependencies (external libraries)
  // ═══════════════════════════════════════════════════════════════════════════

  // Core infrastructure
  container.registerInstance(DI_TOKENS.Database, db);
  container.registerInstance(DI_TOKENS.Redis, redisClient);
  container.registerInstance(DI_TOKENS.RealtimeGateway, realtimeGateway);
  container.registerInstance(DI_TOKENS.Logger, logger);
  container.registerInstance(DI_TOKENS.Environment, env);

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
  container.register(DI_TOKENS.LogFileReader, { useToken: FileSystemLogFileReader });
  container.register(DI_TOKENS.LogArchiveStore, { useToken: FileSystemLogArchiveStore });
  container.register(DI_TOKENS.MetricsWriter, { useToken: InfluxDBMetricsWriter });
  container.register(DI_TOKENS.ObjectStorage, { useToken: S3ObjectStorage });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Register runtime-created managers
  // ═══════════════════════════════════════════════════════════════════════════

  // GameIndexManager is an infrastructure manager, so it uses RedisRepository directly.
  const redisRepository = container.resolve(RedisRepository);
  const gameIndexManager = new GameIndexManager(redisRepository, logger);
  container.registerInstance(DI_TOKENS.GameIndexManager, gameIndexManager);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Register special services that need factory creation
  // ═══════════════════════════════════════════════════════════════════════════

  // PhaseTransitionRouter - uses factory function to create handlers
  const gameService = container.resolve(GameService);
  const packageStore = container.resolve(PackageStore);

  const phaseTransitionRouter = createPhaseTransitionRouter(logger);
  container.registerInstance(PhaseTransitionRouter, phaseTransitionRouter);

  // CronSchedulerService - needs array of cron jobs
  const cronJobFactory = container.resolve(CronJobFactory);
  const cronJobs = cronJobFactory.createAllCronJobs();
  const redisService = container.resolve(RedisService);
  const cronSchedulerService = new CronSchedulerService(cronJobs, redisService, logger);
  container.registerInstance(CronSchedulerService, cronSchedulerService);

  // Redis expiration handlers - array of handlers for Redis keyspace notifications
  // Note: These handlers are auto-resolved (proper DI) rather than manually instantiated
  const timerExpirationHandler = container.resolve(TimerExpirationHandler);
  const gameExpirationHandler = container.resolve(GameExpirationHandler);
  const gameExpirationNotificationHandler = container.resolve(GameExpirationNotificationHandler);
  container.registerInstance(DI_TOKENS.RedisExpirationHandlers, [
    timerExpirationHandler,
    gameExpirationNotificationHandler,
    gameExpirationHandler
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Configure action handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const actionRegistry = container.resolve(GameActionHandlerRegistry);
  const userService = container.resolve(UserService);

  // Resolve all dependencies needed for action handlers
  const actionHandlerDeps: ActionHandlerConfigDeps = {
    registry: actionRegistry,
    socketIOChatService: container.resolve(SocketIOChatService),
    socketGameTimerService: container.resolve(SocketGameTimerService),
    socketGameValidationService: container.resolve(SocketGameValidationService),
    secretQuestionService: container.resolve(SecretQuestionService),
    stakeQuestionService: container.resolve(StakeQuestionService),
    playerGameStatsService: container.resolve(PlayerGameStatsService),
    gameStatisticsCollectorService: container.resolve(GameStatisticsCollectorService),
    playerLeaveService: container.resolve(PlayerLeaveService),
    transitionResourceService: container.resolve(TransitionResourceService),
    userService,
    socketChatRepository: container.resolve(SocketChatRepository),
    gameProgressionCoordinator: container.resolve(GameProgressionCoordinator),
    gameService,
    timerExpirationService: container.resolve(TimerExpirationService),
    phaseTransitionRouter,
    packageStore,
    logger
  };
  configureActionHandlers(actionHandlerDeps);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Post-initialization setup
  // ═══════════════════════════════════════════════════════════════════════════

  // Initialize static TranslateService with logger
  TranslateService.setLogger(logger);
  await TranslateService.initialize();

  // Realtime gateway is registered in STEP 1 and injected where needed.
}

export { container };
