import { type Express } from "express";
import { type Server as HTTPServer } from "http";
import Redis from "ioredis";
import { type Server as IOServer } from "socket.io";

import { type ApiContext } from "shared/context/ApiContext";
import { bootstrapContainer, container } from "./bootstrap/bootstrapContainer";
import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { AdminDiagnosticsService } from "application/services/admin/AdminDiagnosticsService";
import { AdminService } from "application/services/admin/AdminService";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { FileService } from "application/services/file/FileService";
import { FileStorageService } from "application/services/file/FileStorageService";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { GameService } from "application/services/game/GameService";
import { PackageService } from "application/services/package/PackageService";
import { PermissionService } from "application/services/permission/PermissionService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { UserService } from "application/services/user/UserService";
import { SESSION_SECRET_LENGTH } from "domain/constants/session";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { ErrorController } from "domain/errors/ErrorController";
import { EnvType } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { type Database } from "infrastructure/database/Database";
import { LogPrefix } from "shared/logging/LogPrefix";
import { MetricsService } from "application/services/metrics/MetricsService";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { RedisService } from "application/services/redis/RedisService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { S3StorageService } from "application/services/storage/S3StorageService";
import { SocketIOInitializer } from "presentation/controllers/io/SocketIOInitializer";
import { SocketActionDispatcher } from "presentation/controllers/io/SocketActionDispatcher";
import { MiddlewareController } from "presentation/controllers/middleware/MiddlewareController";
import { AdminRestApiController } from "presentation/controllers/rest/AdminRestApiController";
import { AuthRestApiController } from "presentation/controllers/rest/AuthRestApiController";
import { DevelopmentRestApiController } from "presentation/controllers/rest/DevelopmentRestApiController";
import { FileRestApiController } from "presentation/controllers/rest/FileRestApiController";
import { GameRestApiController } from "presentation/controllers/rest/GameRestApiController";
import { PackageRestApiController } from "presentation/controllers/rest/PackageRestApiController";
import { SwaggerRestApiController } from "presentation/controllers/rest/SwaggerRestApiController";
import { UserRestApiController } from "presentation/controllers/rest/UserRestApiController";
import { errorMiddleware } from "presentation/middleware/errorMiddleware";
import { SocketIORealtimeGateway } from "presentation/realtime/SocketIORealtimeGateway";

/**
 * Serves all api controllers and dependencies.
 */
export class ServeApi {
  /** Express app */
  private readonly _app: Express;
  /** SocketIO server */
  private readonly _io: IOServer;
  /** Application listening port */
  private readonly _port: number;
  /** Database instance */
  private readonly _db: Database;
  private readonly _redis: Redis;
  /** HTTP Server */
  private _server!: HTTPServer;

  constructor(private readonly _context: ApiContext) {
    this._db = this._context.db;
    this._app = this._context.app;
    this._io = this._context.io;
    this._redis = RedisConfig.getClient();
    this._port = this._context.env.API_PORT;
  }

  public async init() {
    const initStartTime = Date.now();
    this._context.logger.trace("API initialization started", {
      prefix: LogPrefix.SERVE_API
    });

    const log = this._context.logger.performance(`API initialization`, {
      prefix: LogPrefix.SERVE_API
    });

    try {
      // Load session configuration
      await this._context.env.loadSessionConfig(SESSION_SECRET_LENGTH, this._redis);

      // Build database connection
      await this._db.build();

      // Initialize Dependency Injection Container (tsyringe)
      await bootstrapContainer({
        db: this._db,
        redisClient: this._redis,
        io: this._io,
        realtimeGateway: new SocketIORealtimeGateway(this._io.of(SOCKET_GAME_NAMESPACE)),
        env: this._context.env,
        logger: this._context.logger
      });

      const metricsService = container.resolve(MetricsService);

      // Middlewares
      await new MiddlewareController(this._context, this._redis, metricsService).initialize();

      // Initialize server listening
      this._server = this._app.listen(this._port, () => {
        this._context.logger.info(`App listening on port: ${this._port}`, {
          prefix: LogPrefix.SERVE_API,
          port: this._port
        });
      });
      this._io.listen(this._server);

      metricsService.start();

      await this._processPrepareJobs();

      // Attach API controllers
      this._attachControllers();
      this._app.use(errorMiddleware(this._context.logger));

      log.finish();
    } catch (err: unknown) {
      const failureTime = Date.now() - initStartTime;
      this._context.logger.error(`API initialization failed after ${failureTime}ms`, {
        prefix: LogPrefix.SERVE_API,
        failureTime
      });

      const error = await ErrorController.resolveError(err, this._context.logger);
      this._context.logger.error(`API initialization error: ${error.message}`, {
        prefix: LogPrefix.SERVE_API,
        errorMessage: error.message
      });
    }
  }

  // Get API server instance
  public get server() {
    return this._server;
  }

  /**
   * Initializes API controllers.
   * API controller is an entity, that manages initializing and handling of endpoints
   * to which this controller related (you can see it in their names)
   */
  private _attachControllers() {
    // Resolve all dependencies from tsyringe container
    const deps = {
      app: this._app,
      userService: container.resolve(UserService),
      packageService: container.resolve(PackageService),
      socketUserDataService: container.resolve(SocketUserDataService),
      storage: container.resolve(S3StorageService),
      game: container.resolve(GameService),
      io: this._io, // Use directly instead of from container
      redisService: container.resolve(RedisService),
      fileService: container.resolve(FileService),
      fileStorageService: container.resolve(FileStorageService),
      adminService: container.resolve(AdminService),
      adminDiagnosticsService: container.resolve(AdminDiagnosticsService),
      socketGameContextService: container.resolve(SocketGameContextService),
      gameActionExecutor: container.resolve(GameActionExecutor)
    };

    // REST
    new UserRestApiController(deps.app, deps.userService, deps.fileService, this._context.logger);
    new AuthRestApiController(
      deps.io.of(SOCKET_GAME_NAMESPACE),
      deps.app,
      deps.redisService,
      deps.userService,
      deps.fileService,
      deps.storage,
      deps.socketUserDataService,
      this._context.logger
    );
    new PackageRestApiController(deps.app, deps.packageService, this._context.logger);
    new FileRestApiController(deps.app, deps.fileStorageService);
    new GameRestApiController(deps.app, deps.game, deps.userService);
    new AdminRestApiController(
      deps.app,
      deps.userService,
      this._context.logger,
      deps.adminService,
      deps.adminDiagnosticsService
    );
    new SwaggerRestApiController(deps.app, this._context.logger);

    if (this._context.env.ENV === EnvType.DEV) {
      new DevelopmentRestApiController(
        deps.app,
        deps.userService,
        this._context.env,
        deps.game,
        deps.storage,
        this._context.logger
      );
    }

    const broadcastService = container.resolve(GameActionBroadcastService);
    const metricsService = container.resolve(MetricsService);

    const dispatcher = new SocketActionDispatcher(
      deps.gameActionExecutor,
      deps.socketGameContextService,
      deps.socketUserDataService,
      broadcastService,
      metricsService,
      this._context.logger
    );

    new SocketIOInitializer(deps.io, dispatcher, this._context.logger);
  }

  private async _processPrepareJobs() {
    const pubSub = container.resolve(RedisPubSubService);
    const gameService = container.resolve(GameService);
    const permissionService = container.resolve(PermissionService);

    if (this._context.env.STARTUP_RECOVERY_ENABLED) {
      const socketUserDataService = container.resolve(SocketUserDataService);

      // Clean up all games (set all players as disconnected and pause game)
      await gameService.cleanupAllGames();

      // Clean up all authorized socket sessions
      await socketUserDataService.cleanupAllSession();
    } else {
      this._context.logger.info(
        "Startup recovery disabled; skipping game and socket session cleanup",
        { prefix: LogPrefix.SERVE_API }
      );
    }

    // Clean up games indexes that expires while server was down (if any)
    await gameService.cleanOrphanedGames();

    await permissionService.grantAllPermissionsByEmails(this._context.env.ADMIN_EMAILS);

    // Init key expiration listeners
    await pubSub.initKeyExpirationHandling();

    // Initialize cron scheduler
    const cronScheduler = container.resolve(CronSchedulerService);
    await cronScheduler.initialize();
  }
}
