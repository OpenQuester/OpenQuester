import { createAdapter } from "@socket.io/redis-adapter";
import express, { type Express } from "express";
import session from "express-session";
import { createServer, type Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { type DataSource } from "typeorm";

import { ApiContext } from "shared/context/ApiContext";
import { Environment } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { Database } from "infrastructure/database/Database";
import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { ServeApi } from "../src/ServeApi";
import { TestRestApiController } from "tests/TestRestApiController";
import { setTestEnvDefaults } from "tests/utils/utils";

interface BootstrapTestAppOptions {
  apiPort?: number;
  startupRecoveryEnabled?: boolean;
  apiStartupTimeoutMs?: number;
  apiShutdownTimeoutMs?: number;
  /**
   * Caller-owned logger. ServerTestHarness passes one logger shared with
   * TestEnvironment, while legacy callers get a bootstrap-owned logger.
   */
  logger?: PinoLogger;
}

interface TestAppBootstrapResult {
  app: Express;
  httpServer: HTTPServer;
  io: IOServer;
  api: ServeApi;
  serverUrl: string;
  database: Database;
  dataSource: DataSource;
  cleanup: () => Promise<void>;
}

const DEFAULT_API_STARTUP_TIMEOUT_MS = 5000;
const DEFAULT_API_SHUTDOWN_TIMEOUT_MS = 2000;

export async function bootstrapTestApp(
  testDataSource: DataSource,
  options: BootstrapTestAppOptions = {}
): Promise<TestAppBootstrapResult> {
  const testApp = await createTestAppRuntime(testDataSource, options);

  try {
    await withTimeout(
      testApp.api.init(),
      options.apiStartupTimeoutMs ?? DEFAULT_API_STARTUP_TIMEOUT_MS,
      "test app API startup"
    );
  } catch (error) {
    try {
      await testApp.cleanup();
    } catch (cleanupError) {
      throw combineErrors("Test app startup failed", [
        toCleanupError("Startup", error),
        toCleanupError("Startup cleanup", cleanupError)
      ]);
    }
    throw error;
  }

  testApp.logger.info("Test app initialized", { prefix: LogPrefix.TEST });

  return testApp;
}

export async function createTestAppRuntime(
  testDataSource: DataSource,
  options: BootstrapTestAppOptions = {}
): Promise<TestAppBootstrapResult & { logger: PinoLogger }> {
  const ownsLogger = options.logger === undefined;
  const prefix = LogPrefix.TEST;
  const apiShutdownTimeoutMs = options.apiShutdownTimeoutMs ?? DEFAULT_API_SHUTDOWN_TIMEOUT_MS;
  let logger: PinoLogger | undefined;
  let redisCleanupRequired = false;
  let containerCleanupRequired = false;
  let httpServer: HTTPServer | undefined;
  let io: IOServer | undefined;
  let api: ServeApi | undefined;
  let cleanupPromise: Promise<void> | undefined;

  function cleanup(): Promise<void> {
    cleanupPromise ??= cleanupInternal();
    return cleanupPromise;
  }

  async function cleanupInternal(): Promise<void> {
    const errors: Error[] = [];
    const currentApi = api;
    const currentHttpServer = httpServer;
    const currentIo = io;

    const runCleanupStep = async (
      label: string,
      action: () => Promise<void>,
      operation = `test app ${label}`
    ): Promise<boolean> => {
      try {
        await withTimeout(action(), apiShutdownTimeoutMs, operation);
        return false;
      } catch (error) {
        const cleanupError = toCleanupError(label, error);
        errors.push(cleanupError);
        try {
          logger?.error(cleanupError.message, {
            prefix,
            error: cleanupError.message
          });
        } catch (loggingError) {
          errors.push(toCleanupError(`${label} cleanup failure logging`, loggingError));
        }
        return true;
      }
    };

    if (currentApi) {
      const shutdownFailed = await runCleanupStep(
        "ServeApi shutdown",
        async () => {
          await currentApi.shutdown();
        },
        "test app ServeApi shutdown"
      );

      if (shutdownFailed && currentIo && currentHttpServer) {
        await runCleanupStep("Socket.IO forced close", async () => {
          await closeSocketIo(currentIo, currentHttpServer, apiShutdownTimeoutMs);
        });
      }

      if (currentHttpServer) {
        await runCleanupStep("HTTP server final cleanup", async () => {
          await closeHttpServer(currentHttpServer, apiShutdownTimeoutMs);
        });
      }
    } else {
      if (currentIo && currentHttpServer) {
        await runCleanupStep("Socket.IO close", async () => {
          await closeSocketIo(currentIo, currentHttpServer, apiShutdownTimeoutMs);
        });
      }

      if (currentHttpServer) {
        await runCleanupStep("HTTP server close", async () => {
          await closeHttpServer(currentHttpServer, apiShutdownTimeoutMs);
        });
      }
    }

    if (redisCleanupRequired) {
      await runCleanupStep("Redis disconnect", async () => {
        await RedisConfig.disconnect({ strict: true });
      });
    }

    if (containerCleanupRequired) {
      await runCleanupStep("DI container cleanup", async () => {
        container.clearInstances();
      });
    }

    if (ownsLogger && logger) {
      await runCleanupStep("Logger close", async () => {
        await logger?.close();
      });
    }

    throwIfCleanupFailed("Test app cleanup failed", errors);
  }

  try {
    logger = options.logger ?? (await PinoLogger.init({ pretty: true }));
    containerCleanupRequired = true;

    logger.info("Setting up test application...", { prefix });
    // Patch Database singleton to use test datasource
    const db = Database.getInstance(testDataSource, logger);
    const app = express();

    logger.info("Setting up test environment...", { prefix });
    setTestEnvDefaults({
      apiPort: options.apiPort,
      startupRecoveryEnabled: options.startupRecoveryEnabled
    });

    // Connect to Redis
    logger.info("Connecting to Redis...", { prefix });
    redisCleanupRequired = true;
    const redis = RedisConfig.getClient();
    const sub = RedisConfig.getSubClient();

    await RedisConfig.initConfig();
    await RedisConfig.waitForConnection();

    logger.info("Connecting to Socket.IO...", { prefix });
    httpServer = createServer(app);
    io = new IOServer(httpServer, {
      cors: { origin: "*" },
      adapter: createAdapter(redis, sub),
      cookie: true,
      connectTimeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
      transports: ["websocket"]
    });

    // Add body parser middleware for JSON before any routes
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Add session middleware before any routes/controllers
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "test_secret",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
      })
    );

    // Register test-only controller for session/cookie handling after body parser
    logger.info("Setting up test REST API controller...", { prefix });
    new TestRestApiController(app);

    // Build ApiContext and ServeApi as in production
    const context = new ApiContext({
      db,
      env: Environment.getInstance(logger, { overwrite: true }),
      io,
      app,
      httpServer,
      logger
    });

    context.env.load(true);

    logger.info("Initializing API server...", { prefix });
    const initializedApi = new ServeApi(context);
    api = initializedApi;

    return {
      app,
      httpServer,
      io,
      api: initializedApi,
      get serverUrl(): string {
        return initializedApi.serverUrl;
      },
      database: db,
      dataSource: testDataSource,
      cleanup,
      logger
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw combineErrors("Test app runtime setup failed", [
        toCleanupError("Startup", error),
        toCleanupError("Startup cleanup", cleanupError)
      ]);
    }
    throw error;
  }
}

async function closeSocketIo(
  io: IOServer,
  httpServer: HTTPServer,
  timeoutMs: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (error && !isServerNotRunningError(error)) {
        reject(error);
        return;
      }

      resolve();
    };
    const timeout = setTimeout(() => {
      finish(
        new Error(`Timed out after ${timeoutMs}ms waiting for partial-startup Socket.IO close`)
      );
    }, timeoutMs);

    try {
      const closePromise = io.close((error?: Error) => {
        finish(error);
      });
      httpServer.closeIdleConnections?.();
      void closePromise
        .then(() => finish())
        .catch((error: unknown) => {
          finish(toError(error));
        });
    } catch (error) {
      finish(toError(error));
    }
  });
}

async function closeHttpServer(httpServer: HTTPServer, timeoutMs: number): Promise<void> {
  if (!httpServer.listening) {
    httpServer.removeAllListeners();
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
      httpServer.removeAllListeners();
      if (error) {
        reject(error);
        return;
      }

      resolve();
    };
    const timeout = setTimeout(() => {
      httpServer.closeAllConnections?.();
      finish(new Error(`Timed out after ${timeoutMs}ms waiting for partial-startup HTTP close`));
    }, timeoutMs);

    try {
      httpServer.close((error?: Error) => finish(error));
      httpServer.closeIdleConnections?.();
    } catch (error) {
      finish(toError(error));
    }
  });
}

function isServerNotRunningError(error: Error): boolean {
  return "code" in error && (error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

class TestAppTimeoutError extends Error {
  public constructor(timeoutMs: number, operation: string) {
    super(`Timed out after ${timeoutMs}ms waiting for ${operation}`);
    this.name = "TestAppTimeoutError";
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new TestAppTimeoutError(timeoutMs, operation));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function toCleanupError(label: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${label} failed: ${error.message}`, { cause: error });
  }

  return new Error(`${label} failed: ${String(error)}`);
}

function combineErrors(message: string, errors: Error[]): Error {
  if (errors.length === 1) {
    return errors[0];
  }

  return new AggregateError(errors, message);
}

function throwIfCleanupFailed(message: string, errors: Error[]): void {
  if (errors.length === 0) {
    return;
  }

  throw combineErrors(message, errors);
}
