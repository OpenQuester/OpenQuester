import { type Express } from "express";
import { type Server as HTTPServer } from "http";
import Redis from "ioredis";
import { type Server as IOServer } from "socket.io";

import { DIConfig } from "application/config/DIConfig";
import { Container, CONTAINER_TYPES } from "application/Container";
import { type ApiContext } from "application/context/ApiContext";
import { FileService } from "application/services/file/FileService";
import { GameService } from "application/services/game/GameService";
import { PackageService } from "application/services/package/PackageService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserService } from "application/services/user/UserService";
import { SESSION_SECRET_LENGTH } from "domain/constants/session";
import { ErrorController } from "domain/errors/ErrorController";
import { EnvType } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { type Database } from "infrastructure/database/Database";
import { RedisPubSubService } from "infrastructure/services/redis/RedisPubSubService";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { SocketIOInitializer } from "presentation/controllers/io/SocketIOInitializer";
import { MiddlewareController } from "presentation/controllers/middleware/MiddlewareController";
import { AuthRestApiController } from "presentation/controllers/rest/AuthRestApiController";
import { DevelopmentRestApiController } from "presentation/controllers/rest/DevelopmentRestApiController";
import { FileRestApiController } from "presentation/controllers/rest/FileRestApiController";
import { GameRestApiController } from "presentation/controllers/rest/GameRestApiController";
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
    this._port = 3000;
  }

  public async init() {
    try {
      await this._context.env.loadSessionConfig(
        SESSION_SECRET_LENGTH,
        this._redis
      );

      // Build database connection
      await this._db.build();

      // Middlewares
      await new MiddlewareController(this._context, this._redis).initialize();

      // Initialize server listening
      this._server = this._app.listen(this._port, () => {
        this._context.logger.info(`App listening on port: ${this._port}`);
      });
      this._io.listen(this._server);

      // Initialize Dependency injection Container
      await new DIConfig(
        this._db,
        this._redis,
        this._io,
        this._context.env,
        this._context.logger
      ).initialize();

      await this._processPrepareJobs();

      // Attach API controllers
      this._attachControllers();
      this._app.use(errorMiddleware(this._context.logger));
    } catch (err: unknown) {
      const error = await ErrorController.resolveError(
        err,
        this._context.logger
      );
      this._context.logger.error(`API initialization error: ${error.message}`);
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
    const deps = {
      app: this._app,
      userService: Container.get<UserService>(CONTAINER_TYPES.UserService),
      packageService: Container.get<PackageService>(
        CONTAINER_TYPES.PackageService
      ),
      socketIOGameService: Container.get<SocketIOGameService>(
        CONTAINER_TYPES.SocketIOGameService
      ),
      finalRoundService: Container.get<FinalRoundService>(
        CONTAINER_TYPES.FinalRoundService
      ),
      socketUserDataService: Container.get<SocketUserDataService>(
        CONTAINER_TYPES.SocketUserDataService
      ),
      socketIOChatService: Container.get<SocketIOChatService>(
        CONTAINER_TYPES.SocketIOChatService
      ),
      socketIOQuestionService: Container.get<SocketIOQuestionService>(
        CONTAINER_TYPES.SocketIOQuestionService
      ),
      storage: Container.get<S3StorageService>(
        CONTAINER_TYPES.S3StorageService
      ),
      game: Container.get<GameService>(CONTAINER_TYPES.GameService),
      io: Container.get<IOServer>(CONTAINER_TYPES.IO),
      redisService: Container.get<RedisService>(CONTAINER_TYPES.RedisService),
      fileService: Container.get<FileService>(CONTAINER_TYPES.FileService),
    };

    // REST
    new UserRestApiController(
      deps.app,
      deps.userService,
      deps.fileService,
      this._context.logger
    );
    new AuthRestApiController(
      deps.app,
      deps.redisService,
      deps.userService,
      deps.fileService,
      deps.storage,
      deps.socketUserDataService,
      this._context.logger
    );
    new PackageRestApiController(deps.app, deps.packageService);
    new FileRestApiController(deps.app, deps.storage);
    new GameRestApiController(deps.app, deps.game);
    new SwaggerRestApiController(deps.app, this._context.logger);

    if (this._context.env.ENV === EnvType.DEV) {
      new DevelopmentRestApiController(
        deps.app,
        deps.userService,
        this._context.env,
        deps.game,
        this._context.logger
      );
    }

    // Socket
    new SocketIOInitializer(
      deps.io,
      deps.socketIOGameService,
      deps.socketIOChatService,
      deps.socketUserDataService,
      deps.finalRoundService,
      deps.socketIOQuestionService,
      this._context.logger
    );
  }

  private async _processPrepareJobs() {
    const pubSub = Container.get<RedisPubSubService>(
      CONTAINER_TYPES.RedisPubSubService
    );
    const gameService = Container.get<GameService>(CONTAINER_TYPES.GameService);
    const socketUserDataService = Container.get<SocketUserDataService>(
      CONTAINER_TYPES.SocketUserDataService
    );

    // Clean up all games (set all players as disconnected and pause game)
    await gameService.cleanupAllGames();

    // Clean up games indexes that expires while server was down (if any)
    await gameService.cleanOrphanedGames();

    // Clean up all authorized socket sessions
    await socketUserDataService.cleanupAllSession();

    // Init key expiration listeners
    await pubSub.initKeyExpirationHandling();
  }
}
