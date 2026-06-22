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

export async function bootstrapTestApp(
  testDataSource: DataSource,
  options: BootstrapTestAppOptions = {}
): Promise<TestAppBootstrapResult> {
  const testApp = await createTestAppRuntime(testDataSource, options);

  try {
    await testApp.api.init();
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
  const logger = options.logger ?? (await PinoLogger.init({ pretty: true }));
  const ownsLogger = options.logger === undefined;
  const prefix = LogPrefix.TEST;

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
  const redis = RedisConfig.getClient();
  const sub = RedisConfig.getSubClient();

  await RedisConfig.initConfig();
  await RedisConfig.waitForConnection();

  logger.info("Connecting to Socket.IO...", { prefix });
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
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
  const api = new ServeApi(context);
  let cleanupPromise: Promise<void> | undefined;

  function cleanup(): Promise<void> {
    if (!cleanupPromise) {
      cleanupPromise = cleanupInternal();
    }

    return cleanupPromise;
  }

  async function cleanupInternal(): Promise<void> {
    const errors: Error[] = [];

    const runCleanupStep = async (
      label: string,
      action: () => Promise<void>
    ): Promise<void> => {
      try {
        await action();
      } catch (error) {
        const cleanupError = toCleanupError(label, error);
        logger.error(cleanupError.message, {
          prefix,
          error: cleanupError.message
        });
        errors.push(cleanupError);
      }
    };

    await runCleanupStep("ServeApi shutdown", async () => {
      await api.shutdown();
    });

    await runCleanupStep("Redis disconnect", async () => {
      await RedisConfig.disconnect();
    });

    await runCleanupStep("DI container cleanup", async () => {
      container.clearInstances();
    });

    if (ownsLogger) {
      await runCleanupStep("Logger close", async () => {
        await logger.close();
      });
    }

    throwIfCleanupFailed("Test app cleanup failed", errors);
  }

  return {
    app,
    httpServer,
    io,
    api,
    get serverUrl(): string {
      return api.serverUrl;
    },
    database: db,
    dataSource: testDataSource,
    cleanup,
    logger
  };
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
