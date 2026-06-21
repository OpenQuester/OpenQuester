import { createAdapter } from "@socket.io/redis-adapter";
import express from "express";
import session from "express-session";
import { createServer, type Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { DataSource } from "typeorm";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { ApiContext } from "shared/context/ApiContext";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { MetricsService } from "application/services/metrics/MetricsService";
import { Environment } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { Database } from "infrastructure/database/Database";
import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { ServeApi } from "../src/ServeApi";
import { SocketActionDispatcher } from "presentation/controllers/io/SocketActionDispatcher";
import { TestRestApiController } from "tests/TestRestApiController";
import { setTestEnvDefaults } from "tests/utils/utils";

interface BootstrapTestAppOptions {
  apiPort?: number;
}

export async function bootstrapTestApp(
  testDataSource: DataSource,
  options: BootstrapTestAppOptions = {}
) {
  const logger = await PinoLogger.init({ pretty: true });
  const prefix = LogPrefix.TEST;

  logger.info("Setting up test application...", { prefix });
  // Patch Database singleton to use test datasource
  const db = Database.getInstance(testDataSource, logger);
  const app = express();

  logger.info("Setting up test environment...", { prefix });
  setTestEnvDefaults({ apiPort: options.apiPort });

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
  let isCleanedUp = false;

  // Provide a cleanup function for Socket.IO and HTTP server
  // Close app-level resources and reset shared clients to keep suites isolated.
  async function cleanup() {
    if (isCleanedUp) {
      return;
    }

    isCleanedUp = true;
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

    // Stop cron scheduler to allow tests to exit cleanly
    await runCleanupStep("Cron scheduler stop", async () => {
      const cronScheduler = container.resolve(CronSchedulerService);
      logger.info("Stopping cron scheduler...", { prefix });
      await cronScheduler.stopAll();
    });

    // Unsubscribe from Redis keyspace notifications to prevent duplicate
    // timer expirations across test suites
    await runCleanupStep("Redis pub/sub unsubscribe", async () => {
      const pubSub = container.resolve(RedisPubSubService);
      logger.info("Unsubscribing from Redis keyspace notifications...", {
        prefix
      });
      await pubSub.unsubscribe();
    });

    await runCleanupStep("Metrics service stop", async () => {
      if (container.isRegistered(MetricsService, true)) {
        const metricsService = container.resolve(MetricsService);
        logger.info("Stopping metrics service...", { prefix });
        await metricsService.stop();
      }
    });

    await runCleanupStep("Socket.IO close", async () => {
      await io.close();
      logger.info("Socket.IO server closed", { prefix });
    });

    await runCleanupStep("Socket action dispatcher idle", async () => {
      if (container.isRegistered(SocketActionDispatcher, true)) {
        const dispatcher = container.resolve(SocketActionDispatcher);
        await dispatcher.waitForIdle();
      }
    });

    await runCleanupStep("Game action executor idle", async () => {
      const actionExecutor = container.resolve(GameActionExecutor);
      await actionExecutor.waitForIdle();
    });

    await runCleanupStep("HTTP server close", async () => {
      await closeHttpServer(api.server);
      if (!api.server.listening) {
        logger.info("HTTP server closed", { prefix });
      }
    });

    await runCleanupStep("Redis disconnect", async () => {
      await RedisConfig.disconnect();
    });

    container.clearInstances();

    await runCleanupStep("Logger close", async () => {
      await logger.close();
    });

    throwIfCleanupFailed("Test app cleanup failed", errors);
  }

  try {
    await api.init();
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw combineErrors("Test app startup failed", [
        toCleanupError("Startup", error),
        toCleanupError("Startup cleanup", cleanupError)
      ]);
    }
    throw error;
  }

  logger.info("Test app initialized", { prefix });
  return {
    app,
    httpServer,
    serverUrl: api.serverUrl,
    database: db,
    dataSource: testDataSource,
    cleanup
  };
}

async function closeHttpServer(server: HTTPServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeAllConnections();
  });
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
