import { type Express } from "express";
import { type Server as HTTPServer } from "http";
import Redis from "ioredis";
import { type Server as IOServer } from "socket.io";

import { type ApiContext } from "application/context/ApiContext";
import { bootstrapContainer, container } from "application/di/bootstrap";
import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { AdminService } from "application/services/admin/AdminService";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { FileService } from "application/services/file/FileService";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { PackageService } from "application/services/package/PackageService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { UserService } from "application/services/user/UserService";
import { SESSION_SECRET_LENGTH } from "domain/constants/session";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { ErrorController } from "domain/errors/ErrorController";
import { EnvType } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { type Database } from "infrastructure/database/Database";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogReaderService } from "infrastructure/services/log/LogReaderService";
import { MetricsService } from "infrastructure/services/metrics/MetricsService";
import { RedisPubSubService } from "infrastructure/services/redis/RedisPubSubService";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { SocketIOInitializer } from "presentation/controllers/io/SocketIOInitializer";
import { MiddlewareController } from "presentation/controllers/middleware/MiddlewareController";
import { AdminRestApiController } from "presentation/controllers/rest/AdminRestApiController";
import { AuthRestApiController } from "presentation/controllers/rest/AuthRestApiController";
import { DevelopmentRestApiController } from "presentation/controllers/rest/DevelopmentRestApiController";
import { FileRestApiController } from "presentation/controllers/rest/FileRestApiController";
import { GameRestApiController } from "presentation/controllers/rest/GameRestApiController";
import { MetricsRestApiController } from "presentation/controllers/rest/MetricsRestApiController";
import { PackageRestApiController } from "presentation/controllers/rest/PackageRestApiController";
import { SwaggerRestApiController } from "presentation/controllers/rest/SwaggerRestApiController";
import { UserRestApiController } from "presentation/controllers/rest/UserRestApiController";
import { errorMiddleware } from "presentation/middleware/errorMiddleware";

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
      prefix: LogPrefix.SERVE_API,
    });

    const log = this._context.logger.performance(`API initialization`, {
      prefix: LogPrefix.SERVE_API,
    });

    try {
      // Load session configuration
      await this._context.env.loadSessionConfig(
        SESSION_SECRET_LENGTH,
        this._redis
      );

      // Build database connection
      await this._db.build();

      // Initialize Dependency Injection Container (tsyringe)
      await bootstrapContainer({
        db: this._db,
        redisClient: this._redis,
        io: this._io,
        env: this._context.env,
        logger: this._context.logger,
      });

      const metricsService = container.resolve(MetricsService);

      // Middlewares
      await new MiddlewareController(
        this._context,
        this._redis,
        metricsService
      ).initialize();

      // Initialize server listening
      this._server = this._app.listen(this._port, () => {
        this._context.logger.info(`App listening on port: ${this._port}`, {
          prefix: LogPrefix.SERVE_API,
          port: this._port,
        });
      });
      this._io.listen(this._server);

      // Start dedicated metrics HTTP server for Prometheus scraping
      metricsService.startServer(
        this._context.env.METRICS_PORT,
        this._context.env.METRICS_TOKEN,
        this._context.logger
      );

      await this._processPrepareJobs();

      // Attach API controllers
      this._attachControllers();
      this._app.use(errorMiddleware(this._context.logger));

      log.finish();
    } catch (err: unknown) {
      const failureTime = Date.now() - initStartTime;
      this._context.logger.error(
        `API initialization failed after ${failureTime}ms`,
        {
          prefix: LogPrefix.SERVE_API,
          failureTime,
        }
      );

      const error = await ErrorController.resolveError(
        err,
        this._context.logger
      );
      this._context.logger.error(`API initialization error: ${error.message}`, {
        prefix: LogPrefix.SERVE_API,
        errorMessage: error.message,
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
      socketIOGameService: container.resolve(SocketIOGameService),
      socketUserDataService: container.resolve(SocketUserDataService),
      socketIOChatService: container.resolve(SocketIOChatService),
      socketIOQuestionService: container.resolve(SocketIOQuestionService),
      storage: container.resolve(S3StorageService),
      game: container.resolve(GameService),
      io: this._io, // Use directly instead of from container
      redisService: container.resolve(RedisService),
      fileService: container.resolve(FileService),
      userNotificationRoomService: container.resolve(
        UserNotificationRoomService
      ),
      adminService: container.resolve(AdminService),
      socketGameContextService: container.resolve(SocketGameContextService),
      gameProgressionCoordinator: container.resolve(GameProgressionCoordinator),
      gameActionExecutor: container.resolve(GameActionExecutor),
      logReaderService: container.resolve(LogReaderService),
      metricsService: container.resolve(MetricsService),
    };

    // REST
    new UserRestApiController(
      deps.app,
      deps.userService,
      deps.fileService,
      this._context.logger
    );
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
    new PackageRestApiController(
      deps.app,
      deps.packageService,
      deps.userService,
      this._context.logger
    );
    new FileRestApiController(deps.app, deps.storage);
    new GameRestApiController(deps.app, deps.game);
    new AdminRestApiController(
      deps.app,
      deps.userService,
      deps.redisService,
      this._context.logger,
      deps.adminService,
      deps.logReaderService
    );
    new SwaggerRestApiController(deps.app, this._context.logger);
    new MetricsRestApiController(
      deps.app,
      deps.metricsService,
      this._context.env
    );

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

    // Socket
    new SocketIOInitializer(
      deps.io,
      deps.socketIOGameService,
      deps.socketIOChatService,
      deps.socketUserDataService,
      deps.socketIOQuestionService,
      deps.userNotificationRoomService,
      deps.socketGameContextService,
      deps.gameProgressionCoordinator,
      deps.gameActionExecutor,
      this._context.logger
    );
  }

  private async _processPrepareJobs() {
    const pubSub = container.resolve(RedisPubSubService);
    const gameService = container.resolve(GameService);
    const socketUserDataService = container.resolve(SocketUserDataService);

    // Clean up all games (set all players as disconnected and pause game)
    await gameService.cleanupAllGames();

    // Clean up games indexes that expires while server was down (if any)
    await gameService.cleanOrphanedGames();

    // Clean up all authorized socket sessions
    await socketUserDataService.cleanupAllSession();

    // Init key expiration listeners
    await pubSub.initKeyExpirationHandling();

    // Initialize cron scheduler
    const cronScheduler = container.resolve(CronSchedulerService);
    await cronScheduler.initialize();
  }
}
