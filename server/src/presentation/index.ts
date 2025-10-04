import { instrument } from "@socket.io/admin-ui";
import { createAdapter } from "@socket.io/redis-adapter";
import { hashSync } from "bcryptjs";
import express from "express";
import { createServer, type Server } from "http";
import { Server as IOServer } from "socket.io";

import { Container, CONTAINER_TYPES } from "application/Container";
import { ApiContext } from "application/context/ApiContext";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { ErrorController } from "domain/errors/ErrorController";
import { Environment, EnvType } from "infrastructure/config/Environment";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { AppDataSource } from "infrastructure/database/DataSource";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { ServeApi } from "presentation/ServeApi";

const main = async () => {
  const logger = await PinoLogger.init({ pretty: true });

  // Set loggers on static services
  setLoggers(logger);
  logger.info(`Initializing API Context`);
  logger.info(`API version: ${process.env.npm_package_version}`);

  // Initialize api context
  const app = express();

  const origins =
    process.env.SOCKET_IO_CORS_ORIGINS ?? process.env.CORS_ORIGINS;

  const allowedHosts = origins ? origins.split(",") : [];
  let allOriginsAllowed = allowedHosts.includes("*");

  // No gray method in PinoLogger; use info with prefix for now
  logger.info(`Allowed CORS origins for socket.io: [${allowedHosts}]`, {
    prefix: "[IO CORS]: ",
  });
  if (allowedHosts.some((host) => host === "*")) {
    allOriginsAllowed = true;
    logger.warn("Current socket.io CORS allows all origins !!", {
      prefix: "[IO CORS]: ",
    });
  }

  const redis = RedisConfig.getClient();
  const sub = RedisConfig.getSubClient();

  await RedisConfig.initConfig();
  await RedisConfig.waitForConnection();

  const io = new IOServer(createServer(app), {
    cors: {
      origin: (origin, callback) => {
        if (allOriginsAllowed || !origin) {
          return callback(null, true);
        }

        try {
          const domain = new URL(origin).hostname;
          const isOriginAllowed = allowedHosts.some(
            (allowedHost) =>
              domain === allowedHost ||
              domain.endsWith(`.${allowedHost}`) ||
              origin === allowedHost
          );

          if (isOriginAllowed) {
            return callback(null, origin);
          }
          return callback(
            new Error(`CORS policy: Origin '${origin}' is not allowed`)
          );
        } catch {
          return callback(new Error("CORS policy: Invalid origin provided"));
        }
      },
    },
    adapter: createAdapter(redis, sub),
    cookie: true,
    connectTimeout: 45000,
    transports: ["websocket"],
  });

  const context = new ApiContext({
    db: Database.getInstance(AppDataSource, logger),
    // Overwrite to ensure that logger is async
    env: Environment.getInstance(logger, { overwrite: true }),
    io,
    app,
    logger,
  });

  if (context.env.SOCKET_IO_ADMIN_UI_ENABLE) {
    logger.info("Socket.IO Admin UI enabled");
    instrument(io, {
      auth: {
        type: "basic",
        username: context.env.SOCKET_IO_ADMIN_UI_USERNAME,
        password: hashSync(context.env.SOCKET_IO_ADMIN_UI_PASSWORD, 10),
      },
      mode: context.env.ENV === EnvType.PROD ? "production" : "development",
    });
  }

  logger.info(`Starting server process: ${process.pid}`);

  context.env.load(false);

  ["SIGINT", "SIGTERM", "uncaughtException"].forEach((signal) => {
    process.on(
      signal,
      async (error) =>
        await gracefulShutdown(context, api?.server, logger, error)
    );
  });

  const api = new ServeApi(context);

  await api.init();

  if (!api || !api.server) {
    logger.error(`API serve error`);
    await gracefulShutdown(context, api?.server, logger);
  }
};

async function gracefulShutdown(
  ctx: ApiContext,
  server: Server | undefined,
  logger: PinoLogger,
  error?: unknown
) {
  if (error instanceof Error) {
    await ErrorController.resolveError(error, logger);
    logger.warn("Server closed due to error");
    await logger.close();
    process.exit(1);
  }
  if (!server) {
    logger.warn("Server not initiated");
    await logger.close();
    return process.exit(1);
  }
  setTimeout(async () => {
    await logger.close();
    process.exit(1);
  }, 5000);

  // Stop cron jobs
  try {
    const cronScheduler = Container.get<CronSchedulerService>(
      CONTAINER_TYPES.CronSchedulerService
    );
    logger.info("Stopping cron scheduler...");
    await cronScheduler.stopAll();
  } catch (error) {
    logger.warn("Failed to stop cron scheduler", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  server.close();
  await ctx.db.disconnect();
  await ctx.io.close();
  await RedisConfig.disconnect();
  logger.info("Server closed gracefully");
  await logger.close();
  process.exit(0);
}

function setLoggers(logger: ILogger) {
  RedisConfig.setLogger(logger);
}

void main();
