import { createAdapter } from "@socket.io/redis-adapter";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { DataSource } from "typeorm";

import { ApiContext } from "application/context/ApiContext";
import { Environment } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { Logger } from "infrastructure/utils/Logger";
import { ServeApi } from "presentation/ServeApi";
import { TestRestApiController } from "tests/TestRestApiController";
import { setTestEnvDefaults } from "tests/utils/utils";

export async function bootstrapTestApp(testDataSource: DataSource) {
  Logger.info("Setting up test application...");
  // Patch Database singleton to use test datasource
  const db = Database.getInstance(testDataSource);
  const app = express();

  Logger.gray("Setting up test environment...");
  setTestEnvDefaults();

  // Connect to Redis
  Logger.gray("Connecting to Redis...");
  const redis = RedisConfig.getClient();
  const sub = RedisConfig.getSubClient();

  await RedisConfig.initConfig();
  await RedisConfig.waitForConnection();

  Logger.gray("Connecting to Socket.IO...");
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
  Logger.gray("Setting up test REST API controller...");
  new TestRestApiController(app);

  // Build ApiContext and ServeApi as in production
  const context = new ApiContext({
    db,
    env: Environment.instance,
    io,
    app,
  });

  context.env.load(true);

  Logger.gray("Initializing API server...");
  const api = new ServeApi(context);
  await api.init();

  // Provide a cleanup function for Redis, Socket.IO, and HTTP server
  async function cleanup() {
    await io.close();
    await RedisConfig.disconnect();
    if (httpServer.listening) {
      return new Promise<void>((resolve) => {
        httpServer.close(() => {
          Logger.info("HTTP server closed");
          resolve();
        });
      });
    }
  }

  Logger.info("Test app initialized");
  return { app, httpServer, dataSource: testDataSource, cleanup };
}
