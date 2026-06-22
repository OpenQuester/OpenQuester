import { type Express } from "express";
import { type Server as HTTPServer } from "http";
import { type AddressInfo } from "net";
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

const SOCKET_IO_CLOSE_TIMEOUT_MS = 5000;
const HTTP_SERVER_CLOSE_TIMEOUT_MS = 5000;

type ServeApiState =
  | "created"
  | "initializing"
  | "running"
  | "failed"
  | "shutting_down"
  | "shutdown"
  | "shutdown_failed";

interface SocketDiagnostic {
  namespace: string;
  socketId: string;
  userId: number | undefined;
  gameId: string | null | undefined;
}

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
  private readonly _server: HTTPServer;
  private _serverUrl: string | undefined;
  private _state: ServeApiState = "created";
  // This Promise coordinates shutdown of this process only.
  // Shared game/action state remains Redis-backed.
  private _shutdownPromise: Promise<void> | undefined;
  private _metricsService: MetricsService | undefined;
  private _pubSubService: RedisPubSubService | undefined;
  private _cronSchedulerService: CronSchedulerService | undefined;
  private _socketActionDispatcher: SocketActionDispatcher | undefined;

  constructor(private readonly _context: ApiContext) {
    this._db = this._context.db;
    this._app = this._context.app;
    this._server = this._context.httpServer;
    this._io = this._context.io;
    this._redis = RedisConfig.getClient();
    this._port = this._context.env.API_PORT;
  }

  public async init(): Promise<void> {
    if (this._state === "running") {
      return;
    }
    if (this._state !== "created") {
      throw new Error(`ServeApi cannot initialize from state "${this._state}"`);
    }

    this._state = "initializing";
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

      this._metricsService = container.resolve(MetricsService);

      // Middlewares
      await new MiddlewareController(
        this._context,
        this._redis,
        this._metricsService
      ).initialize();

      this._attachControllers();
      this._app.use(errorMiddleware(this._context.logger));

      await this._listen();

      await this._runStartupPreparation();
      await this._initializeRedisSubscriptions();
      await this._initializeCronScheduler();
      this._startMetrics();

      this._state = "running";
      log.finish();
    } catch (err: unknown) {
      const failureTime = Date.now() - initStartTime;
      this._state = "failed";
      this._context.logger.error(`API initialization failed after ${failureTime}ms`, {
        prefix: LogPrefix.SERVE_API,
        failureTime
      });

      const error = await ErrorController.resolveError(err, this._context.logger);
      this._context.logger.error(`API initialization error: ${error.message}`, {
        prefix: LogPrefix.SERVE_API,
        errorMessage: error.message
      });

      try {
        await this.shutdown();
      } catch (rollbackError) {
        throw new AggregateError(
          [toLifecycleError("ServeApi startup", err), toLifecycleError("ServeApi rollback", rollbackError)],
          "ServeApi startup failed"
        );
      }

      throw err;
    }
  }

  /**
   * Stops application-level runtime resources initialized by this instance.
   * Composition roots still own database, root Redis clients, DI cleanup,
   * logger close, and process exit.
   */
  public shutdown(): Promise<void> {
    if (!this._shutdownPromise) {
      this._shutdownPromise = this._shutdown();
    }

    return this._shutdownPromise;
  }

  // Get API server instance
  public get server(): HTTPServer {
    return this._server;
  }

  public get serverUrl(): string {
    if (!this._serverUrl) {
      this._serverUrl = this._createServerUrl();
    }

    return this._serverUrl;
  }

  /**
   * Initializes API controllers.
   * API controller is an entity, that manages initializing and handling of endpoints
   * to which this controller related (you can see it in their names)
   */
  private _attachControllers(): void {
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

    this._socketActionDispatcher = dispatcher;
    new SocketIOInitializer(deps.io, dispatcher, this._context.logger);
  }

  private async _runStartupPreparation(): Promise<void> {
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
  }

  private async _initializeRedisSubscriptions(): Promise<void> {
    this._pubSubService = container.resolve(RedisPubSubService);
    await this._pubSubService.initKeyExpirationHandling();
  }

  private async _initializeCronScheduler(): Promise<void> {
    this._cronSchedulerService = container.resolve(CronSchedulerService);
    await this._cronSchedulerService.initialize();
  }

  private _startMetrics(): void {
    this._metricsService?.start();
  }

  private async _listen(): Promise<void> {
    if (this._server.listening) {
      this._serverUrl = this._createServerUrl();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        this._server.off("listening", onListening);
        reject(toLifecycleError(`HTTP listen on port ${this._port}`, error));
      };
      const onListening = (): void => {
        this._server.off("error", onError);
        this._serverUrl = this._createServerUrl();
        this._context.logger.info(`App listening at ${this._serverUrl}`, {
          prefix: LogPrefix.SERVE_API,
          port: this._getServerPort()
        });
        resolve();
      };

      this._server.once("error", onError);
      this._server.once("listening", onListening);
      this._server.listen(this._port);
    });
  }

  private async _shutdown(): Promise<void> {
    this._state = "shutting_down";
    const errors: Error[] = [];

    await this._collectCleanupFailure(errors, "Cron scheduler stop", async () => {
      if (this._cronSchedulerService) {
        await this._cronSchedulerService.stopAll();
      }
    });

    await this._collectCleanupFailure(errors, "Redis pub/sub unsubscribe", async () => {
      if (this._pubSubService) {
        await this._pubSubService.unsubscribe();
      }
    });

    await this._collectCleanupFailure(errors, "Metrics service stop", async () => {
      if (this._metricsService) {
        await this._metricsService.stop();
      }
    });

    await this._collectCleanupFailure(errors, "Socket.IO close", async () => {
      await this._closeSocketIO();
    });

    await this._collectCleanupFailure(errors, "HTTP server close", async () => {
      await this._closeHttpServer();
    });

    if (errors.length > 0) {
      this._state = "shutdown_failed";
      throw new AggregateError(errors, "ServeApi shutdown failed");
    }

    this._state = "shutdown";
  }

  private async _collectCleanupFailure(
    errors: Error[],
    label: string,
    action: () => Promise<void>
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      const cleanupError = toLifecycleError(label, error);
      this._context.logger.error(cleanupError.message, {
        prefix: LogPrefix.SERVE_API,
        error: cleanupError.message
      });
      errors.push(cleanupError);
    }
  }

  private async _closeSocketIO(): Promise<void> {
    const connectedSockets = this._collectConnectedSockets();
    if (!this._server.listening && connectedSockets.length === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        this._context.logger.info("Socket.IO server closed", {
          prefix: LogPrefix.SERVE_API
        });
        resolve();
      };

      const timeout = setTimeout(() => {
        finish(
          new Error(
            `Timed out after ${SOCKET_IO_CLOSE_TIMEOUT_MS}ms waiting for Socket.IO close callback ` +
              this._formatSocketDiagnostics(connectedSockets)
          )
        );
      }, SOCKET_IO_CLOSE_TIMEOUT_MS);
      timeout.unref();

      try {
        void this._io.close((error?: Error) => {
          finish(error);
        }).catch((error: unknown) => {
          finish(toError(error));
        });
      } catch (error) {
        finish(toError(error));
      }
    });
  }

  private async _closeHttpServer(): Promise<void> {
    if (!this._server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        this._context.logger.info("HTTP server closed", {
          prefix: LogPrefix.SERVE_API
        });
        resolve();
      };

      const timeout = setTimeout(() => {
        if (typeof this._server.closeAllConnections === "function") {
          this._server.closeAllConnections();
        }
        finish(
          new Error(
            `Timed out after ${HTTP_SERVER_CLOSE_TIMEOUT_MS}ms waiting for HTTP server graceful close`
          )
        );
      }, HTTP_SERVER_CLOSE_TIMEOUT_MS);
      timeout.unref();

      try {
        this._server.close((error?: Error) => {
          finish(error);
        });
      } catch (error) {
        finish(toError(error));
      }
    });
  }

  private _collectConnectedSockets(): SocketDiagnostic[] {
    // namespace.sockets is local to this process; this is shutdown diagnostics only.
    return ["/", SOCKET_GAME_NAMESPACE].flatMap((namespaceName) => {
      const namespace = this._io.of(namespaceName);
      return [...namespace.sockets.values()].map((socket) => ({
        namespace: namespace.name,
        socketId: socket.id,
        userId: socket.userId,
        gameId: socket.gameId
      }));
    });
  }

  private _formatSocketDiagnostics(sockets: SocketDiagnostic[]): string {
    if (sockets.length === 0) {
      return "(connectedSockets=0)";
    }

    const details = sockets
      .map(
        (socket) =>
          `namespace="${socket.namespace}", socketId="${socket.socketId}", ` +
          `userId=${socket.userId ?? "unknown"}, gameId=${socket.gameId ?? "unknown"}`
      )
      .join("; ");

    return `(connectedSockets=${sockets.length}, sockets=[${details}])`;
  }

  private _createServerUrl(): string {
    const address = this._server.address();
    if (address === null) {
      throw new Error("HTTP server is not listening");
    }
    if (typeof address === "string") {
      throw new Error(`HTTP server is listening on unsupported pipe address: ${address}`);
    }

    return `http://${this._normalizeClientHost(address)}:${address.port}`;
  }

  private _getServerPort(): number {
    const address = this._server.address();
    if (address === null || typeof address === "string") {
      return this._port;
    }

    return address.port;
  }

  private _normalizeClientHost(address: AddressInfo): string {
    if (address.address === "::" || address.address === "0.0.0.0") {
      return "127.0.0.1";
    }
    if (address.family === "IPv6") {
      return `[${address.address}]`;
    }

    return address.address;
  }
}

function toLifecycleError(label: string, error: unknown): Error {
  const cause = error instanceof Error ? error : undefined;
  const message = cause?.message ?? String(error);

  return new Error(`${label} failed: ${message}`, { cause });
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
