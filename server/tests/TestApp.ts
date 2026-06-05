import { createAdapter } from "@socket.io/redis-adapter";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { DataSource } from "typeorm";

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
import { TestRestApiController } from "tests/TestRestApiController";
import { setTestEnvDefaults } from "tests/utils/utils";

export async function bootstrapTestApp(testDataSource: DataSource) {
  const logger = await PinoLogger.init({ pretty: true });
  const prefix = LogPrefix.TEST;

  logger.info("Setting up test application...", { prefix });
  // Patch Database singleton to use test datasource
  const db = Database.getInstance(testDataSource, logger);
  const app = express();

  logger.info("Setting up test environment...", { prefix });
  setTestEnvDefaults();

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
    logger
  });

  context.env.load(true);

  logger.info("Initializing API server...", { prefix });
  const api = new ServeApi(context);
  await api.init();

  // Provide a cleanup function for Socket.IO and HTTP server
  // Close app-level resources and reset shared clients to keep suites isolated.
  async function cleanup() {
    // Stop cron scheduler to allow tests to exit cleanly
    const cronScheduler = container.resolve(CronSchedulerService);
    logger.info("Stopping cron scheduler...", { prefix });
    await cronScheduler.stopAll();

    // Unsubscribe from Redis keyspace notifications to prevent duplicate
    // timer expirations across test suites
    const pubSub = container.resolve(RedisPubSubService);
    logger.info("Unsubscribing from Redis keyspace notifications...", {
      prefix
    });
    await pubSub.unsubscribe();

    if (container.isRegistered(MetricsService, true)) {
      const metricsService = container.resolve(MetricsService);
      logger.info("Stopping metrics service...", { prefix });
      await metricsService.stop();
    }

    // api.server is the HTTP server created by app.listen() inside ServeApi.init()
    // (httpServer above was never .listen()'d, so it is not the one bound to port).
    // Force-close lingering keep-alive connections so the port is released
    // immediately; then close Socket.IO using the callback form — io.close()
    // returns 'this', not a Promise, so without a callback await resolves
    // instantly and the port stays bound for the next test suite.
    if (api.server && api.server.listening) {
      api.server.closeAllConnections();
    }

    await new Promise<void>((resolve) => {
      if (api.server === undefined) {
        resolve();
        return;
      }

      io.close(() => {
        logger.info("Socket.IO server closed", { prefix });
        resolve();
      }).catch((err) => {
        logger.info(`Socket.IO server closed with error, ${err}`, { prefix });
        resolve();
      });
    });

    if (api.server && api.server.listening) {
      await new Promise<void>((resolve, reject) => {
        api.server.close((err) => {
          if (err) {
            reject(err);
            return;
          }

          logger.info("HTTP server closed", { prefix });
          resolve();
        });
      });
    }

    // Allow adapter/socket close callbacks to flush before Redis shutdown.
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.TEST_CLEANUP_DRAIN_MS));

    try {
      await RedisConfig.disconnect();
    } catch (error) {
      logger.warn("Redis disconnect during test cleanup failed", {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    container.clearInstances();
    await logger.close();
  }

  logger.info("Test app initialized", { prefix });
  return { app, httpServer, dataSource: testDataSource, cleanup };
}
