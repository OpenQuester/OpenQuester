import { createAdapter } from "@socket.io/redis-adapter";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

import { ApiContext } from "application/context/ApiContext";
import { Environment } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { ServeApi } from "presentation/ServeApi";
import { TestRestApiController } from "tests/TestRestApiController";

export async function bootstrapTestApp(testDataSource: any) {
  // Patch Database singleton to use test datasource
  const db = Database.getInstance(testDataSource);
  const app = express();

  process.env.NODE_ENV = "test";
  process.env.ENV = "test";
  process.env.SESSION_SECRET = "test_secret";
  process.env.API_DOMAIN = "localhost";
  process.env.SESSION_MAX_AGE = "3600000";
  process.env.REDIS_DB_NUMBER = "12";

  // Connect to Redis
  const redis = RedisConfig.getClient();
  const sub = RedisConfig.getSubClient();

  await RedisConfig.initConfig();
  await RedisConfig.waitForConnection();

  const io = new IOServer(createServer(app), {
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
  new TestRestApiController(app);

  // Build ApiContext and ServeApi as in production
  const context = new ApiContext({
    db,
    env: Environment.instance,
    io,
    app,
  });

  context.env.load(true);

  const api = new ServeApi(context);
  await api.init();

  // Provide a cleanup function for Redis, Socket.IO, and HTTP server
  async function cleanup() {
    await io.close();
    await RedisConfig.disconnect();
  }

  return { app, dataSource: testDataSource, cleanup };
}
