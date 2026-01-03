import { createAdapter } from "@socket.io/redis-adapter";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { DataSource } from "typeorm";

import { ApiContext } from "application/context/ApiContext";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { Environment } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { RedisPubSubService } from "infrastructure/services/redis/RedisPubSubService";
import { ServeApi } from "presentation/ServeApi";
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
    connectTimeout: 45000,
    transports: ["websocket"],
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
      cookie: { secure: false },
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
    logger,
  });

  context.env.load(true);

  logger.info("Initializing API server...", { prefix });
  const api = new ServeApi(context);
  await api.init();

  // Provide a cleanup function for Socket.IO and HTTP server
  // Note: Redis is NOT disconnected here as it's shared across test suites
  async function cleanup() {
    // Stop cron scheduler to allow tests to exit cleanly
    const cronScheduler = container.resolve(CronSchedulerService);
    logger.info("Stopping cron scheduler...", { prefix });
    await cronScheduler.stopAll();

    // Unsubscribe from Redis keyspace notifications to prevent duplicate
    // timer expirations across test suites
    const pubSub = container.resolve(RedisPubSubService);
    logger.info("Unsubscribing from Redis keyspace notifications...", {
      prefix,
    });
    await pubSub.unsubscribe();

    await io.close();
    if (httpServer.listening) {
      return new Promise<void>((resolve) => {
        httpServer.close(() => {
          logger.info("HTTP server closed", { prefix });
          resolve();
        });
      });
    }
  }

  logger.info("Test app initialized", { prefix });
  return { app, httpServer, dataSource: testDataSource, cleanup };
}
