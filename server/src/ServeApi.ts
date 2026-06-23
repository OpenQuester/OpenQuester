import { type Express, type NextFunction, type Request, type Response } from "express";
import { type Server as HTTPServer } from "http";
import { type AddressInfo } from "net";
import Redis from "ioredis";
import { type Server as IOServer, type Socket } from "socket.io";

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
import { HttpStatus } from "domain/enums/HttpStatus";
import { EnvType } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { type Database } from "infrastructure/database/Database";
import { LogPrefix } from "shared/logging/LogPrefix";
import { MetricsService } from "application/services/metrics/MetricsService";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { RedisService } from "application/services/redis/RedisService";
import { SingleInstanceRestartRecoveryService } from "application/services/recovery/SingleInstanceRestartRecoveryService";
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
const READINESS_RETRY_AFTER_SECONDS = "1";
const SOCKET_ADMISSION_NOT_READY_ERROR = "server-not-ready";

type ServeApiState =
  | "created"
  | "initializing"
  | "listening_not_ready"
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
  // These fields coordinate this process lifecycle only; shared game/action
  // correctness remains Redis/PostgreSQL-backed and adapter-aware.
  private _initPromise: Promise<void> | undefined;
  private _shutdownPromise: Promise<void> | undefined;
  private _cleanupPromise: Promise<void> | undefined;
  private _shutdownRequested = false;
  private _admissionMiddlewareInstalled = false;
  private _socketAdmissionInstalled = false;
  private readonly _readinessPromise: Promise<void>;
  private _resolveReadiness!: () => void;
  private _rejectReadiness!: (error: Error) => void;
  private _readinessSettled = false;
  private _metricsService: MetricsService | undefined;
  private _pubSubService: RedisPubSubService | undefined;
  private _cronSchedulerService: CronSchedulerService | undefined;

  constructor(private readonly _context: ApiContext) {
    this._db = this._context.db;
    this._app = this._context.app;
    this._server = this._context.httpServer;
    this._io = this._context.io;
    this._redis = RedisConfig.getClient();
    this._port = this._context.env.API_PORT;
    this._readinessPromise = new Promise<void>((resolve, reject) => {
      this._resolveReadiness = resolve;
      this._rejectReadiness = reject;
    });
    void this._readinessPromise.catch(() => undefined);
  }

  public init(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this._init();
    }

    return this._initPromise;
  }

  private async _init(): Promise<void> {
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
      this._assertStartupCanContinue("session configuration");
      await this._context.env.loadSessionConfig(SESSION_SECRET_LENGTH, this._redis);

      // Build database connection
      this._assertStartupCanContinue("database connection");
      await this._db.build();

      // Initialize Dependency Injection Container (tsyringe)
      this._assertStartupCanContinue("dependency injection bootstrap");
      await bootstrapContainer({
        db: this._db,
        redisClient: this._redis,
        io: this._io,
        realtimeGateway: new SocketIORealtimeGateway(this._io.of(SOCKET_GAME_NAMESPACE)),
        env: this._context.env,
        logger: this._context.logger
      });

      this._metricsService = container.resolve(MetricsService);

      this._installHttpAdmissionMiddleware();
      this._installSocketAdmissionMiddleware();

      // Middlewares
      this._assertStartupCanContinue("HTTP middleware initialization");
      await new MiddlewareController(
        this._context,
        this._redis,
        this._metricsService
      ).initialize();

      this._assertStartupCanContinue("REST and Socket.IO controller initialization");
      this._attachControllers();
      this._app.use(errorMiddleware(this._context.logger));

      this._assertStartupCanContinue("HTTP listen");
      await this._listen();
      if (!this._shutdownRequested && this._server.listening) {
        this._state = "listening_not_ready";
      }

      await this._runStartupPreparation();
      this._assertStartupCanContinue("Redis subscription");
      await this._initializeRedisSubscriptions();
      this._assertStartupCanContinue("cron initialization");
      await this._initializeCronScheduler();
      this._assertStartupCanContinue("metrics start");
      this._startMetrics();

      this._assertStartupCanContinue("ready transition");
      this._state = "running";
      this._markReadinessReady();
      log.finish();
    } catch (err: unknown) {
      const failureTime = Date.now() - initStartTime;
      if (!this._shutdownRequested) {
        this._state = "failed";
      }
      this._markReadinessRejected(toLifecycleError("ServeApi startup", err));
      this._context.logger.error(`API initialization failed after ${failureTime}ms`, {
        prefix: LogPrefix.SERVE_API,
        failureTime
      });

      try {
        const error = await ErrorController.resolveError(err, this._context.logger);
        this._context.logger.error(`API initialization error: ${error.message}`, {
          prefix: LogPrefix.SERVE_API,
          errorMessage: error.message
        });
      } catch (loggingError) {
        this._context.logger.error(`API initialization error formatting failed`, {
          prefix: LogPrefix.SERVE_API,
          errorMessage: toError(loggingError).message
        });
      }

      this._requestShutdown();

      try {
        await this._ensureCleanup();
      } catch (cleanupError) {
        throw new AggregateError(
          [
            toLifecycleError("ServeApi startup", err),
            toLifecycleError("ServeApi startup rollback", cleanupError)
          ],
          "ServeApi startup failed and rollback was incomplete"
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
    this._requestShutdown();
    if (!this._shutdownPromise) {
      this._shutdownPromise = this._shutdownAfterInitSettles();
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

    new SocketIOInitializer(deps.io, dispatcher, this._context.logger);
  }

  private async _runStartupPreparation(): Promise<void> {
    const gameService = container.resolve(GameService);
    const permissionService = container.resolve(PermissionService);
    const restartRecoveryService = container.resolve(SingleInstanceRestartRecoveryService);

    this._assertStartupCanContinue("single-instance restart recovery");
    await restartRecoveryService.recoverIfEnabled();

    this._assertStartupCanContinue("orphaned game index cleanup");
    // Clean up games indexes that expires while server was down (if any)
    await gameService.cleanOrphanedGames();

    this._assertStartupCanContinue("permission synchronization");
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

  private _installHttpAdmissionMiddleware(): void {
    if (this._admissionMiddlewareInstalled) {
      return;
    }

    this._admissionMiddlewareInstalled = true;

    this._app.get("/health/live", (_req: Request, res: Response) => {
      res.status(HttpStatus.OK).json({ status: "live" });
    });

    this._app.get("/health/ready", (_req: Request, res: Response) => {
      this._sendReadinessResponse(res);
    });

    this._app.use((req: Request, res: Response, next: NextFunction) => {
      if (this._isHealthPath(req.path)) {
        return next();
      }

      if (this._isReady()) {
        return next();
      }

      return this._sendNotReadyResponse(res);
    });
  }

  private _installSocketAdmissionMiddleware(): void {
    if (this._socketAdmissionInstalled) {
      return;
    }

    this._socketAdmissionInstalled = true;
    const admissionMiddleware = async (
      _socket: Socket,
      next: (err?: Error) => void
    ): Promise<void> => {
      try {
        await this._waitForSocketAdmission();
        next();
      } catch (error) {
        next(new Error(SOCKET_ADMISSION_NOT_READY_ERROR, { cause: toError(error) }));
      }
    };

    this._io.use(admissionMiddleware);
    this._io.of(SOCKET_GAME_NAMESPACE).use(admissionMiddleware);
  }

  private async _waitForSocketAdmission(): Promise<void> {
    if (this._isReady()) {
      return;
    }

    if (this._shutdownRequested || !this._initPromise) {
      throw new Error(SOCKET_ADMISSION_NOT_READY_ERROR);
    }

    await this._readinessPromise;

    if (!this._isReady()) {
      throw new Error(SOCKET_ADMISSION_NOT_READY_ERROR);
    }
  }

  private _markReadinessReady(): void {
    if (this._readinessSettled) {
      return;
    }

    this._readinessSettled = true;
    this._resolveReadiness();
  }

  private _markReadinessRejected(error: Error): void {
    if (this._readinessSettled) {
      return;
    }

    this._readinessSettled = true;
    this._rejectReadiness(error);
  }

  private _sendReadinessResponse(res: Response): Response {
    res.setHeader("Cache-Control", "no-store");

    if (this._isReady()) {
      return res.status(HttpStatus.OK).json({ status: "ready" });
    }

    return this._sendNotReadyResponse(res);
  }

  private _sendNotReadyResponse(res: Response): Response {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", READINESS_RETRY_AFTER_SECONDS);
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: "not_ready" });
  }

  private _isHealthPath(path: string): boolean {
    return path === "/health/live" || path === "/health/ready";
  }

  private _isReady(): boolean {
    return this._state === "running" && !this._shutdownRequested;
  }

  private _assertStartupCanContinue(stage: string): void {
    if (this._shutdownRequested) {
      throw new Error(`ServeApi startup aborted before ${stage}: shutdown requested`);
    }
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

  private async _shutdownAfterInitSettles(): Promise<void> {
    if (this._initPromise) {
      try {
        await this._initPromise;
      } catch {
        // Startup failure has already been logged and rolled back by init().
      }
    }

    await this._ensureCleanup();
  }

  private _requestShutdown(): void {
    this._shutdownRequested = true;
    this._markReadinessRejected(new Error(SOCKET_ADMISSION_NOT_READY_ERROR));
  }

  private _ensureCleanup(): Promise<void> {
    this._cleanupPromise ??= this._cleanupInternal();
    return this._cleanupPromise;
  }

  private async _cleanupInternal(): Promise<void> {
    if (this._state === "shutdown") {
      return;
    }

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

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (error && !this._isBenignPreListenSocketIoCloseError(error)) {
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

  private _isBenignPreListenSocketIoCloseError(error: Error): boolean {
    return (
      hasErrorCode(error, "ERR_SERVER_NOT_RUNNING") &&
      error.message === "Server is not running."
    );
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

function hasErrorCode(error: Error, code: string): boolean {
  return (
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}
