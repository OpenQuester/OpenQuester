// reflect-metadata must be imported at the very top for tsyringe decorators
import "reflect-metadata";

import { instrument } from "@socket.io/admin-ui";
import { createAdapter } from "@socket.io/redis-adapter";
import { hashSync } from "bcryptjs";
import express from "express";
import { createServer, type Server } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";

import { ApiContext } from "shared/context/ApiContext";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { ErrorController } from "domain/errors/ErrorController";
import { Environment, EnvType } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { AppDataSource } from "infrastructure/database/DataSource";
import { TypeOrmLoggerAdapter } from "infrastructure/database/TypeOrmLoggerAdapter";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { MetricsService } from "application/services/metrics/MetricsService";
import { ServeApi } from "./ServeApi";

const FORCE_SHUTDOWN_TIMEOUT_MS = 5000;
const LOGGER_CLOSE_TIMEOUT_MS = 1000;
let shutdownInProgress = false;

const main = async () => {
  const logger = await PinoLogger.init({ pretty: true });

  // Set loggers on static services
  setLoggers(logger);
  AppDataSource.setOptions({
    logger: new TypeOrmLoggerAdapter(logger)
  });
  logger.info(`Initializing API Context`, { prefix: LogPrefix.SERVER });
  logger.info(`API version: ${process.env.npm_package_version}`, {
    prefix: LogPrefix.SERVER,
    apiVersion: process.env.npm_package_version
  });

  // Initialize api context
  const app = express();

  const origins = process.env.SOCKET_IO_CORS_ORIGINS ?? process.env.CORS_ORIGINS;

  const allowedHosts = origins ? origins.split(",") : [];
  let allOriginsAllowed = allowedHosts.includes("*");

  // No gray method in PinoLogger; use info with prefix for now
  logger.info(`Allowed CORS origins for socket.io: [${allowedHosts}]`, {
    prefix: LogPrefix.IO_CORS
  });
  if (allowedHosts.some((host) => host === "*")) {
    allOriginsAllowed = true;
    logger.warn("Current socket.io CORS allows all origins !!", {
      prefix: LogPrefix.IO_CORS
    });
  }

  const redis = RedisConfig.getClient();
  const sub = RedisConfig.getSubClient();

  await RedisConfig.initConfig();
  await RedisConfig.waitForConnection();

  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (allOriginsAllowed || !origin) {
          return callback(null, true);
        }

        try {
          const domain = new URL(origin).hostname;
          const isOriginAllowed = allowedHosts.some(
            (allowedHost) =>
              domain === allowedHost || domain.endsWith(`.${allowedHost}`) || origin === allowedHost
          );

          if (isOriginAllowed) {
            return callback(null, origin);
          }
          return callback(new Error(`CORS policy: Origin '${origin}' is not allowed`));
        } catch {
          return callback(new Error("CORS policy: Invalid origin provided"));
        }
      }
    },
    adapter: createAdapter(redis, sub),
    cookie: true,
    connectTimeout: 45000,
    transports: ["websocket"]
  });

  const context = new ApiContext({
    db: Database.getInstance(AppDataSource, logger),
    // Overwrite to ensure that logger is async
    env: Environment.getInstance(logger, { overwrite: true }),
    io,
    app,
    httpServer,
    logger
  });

  if (context.env.SOCKET_IO_ADMIN_UI_ENABLE) {
    logger.info("Socket.IO Admin UI enabled", { prefix: LogPrefix.SERVER });
    instrument(io, {
      auth: {
        type: "basic",
        username: context.env.SOCKET_IO_ADMIN_UI_USERNAME,
        password: hashSync(context.env.SOCKET_IO_ADMIN_UI_PASSWORD, 10)
      },
      mode: context.env.ENV === EnvType.PROD ? "production" : "development"
    });
  }

  logger.info(`Starting server process: ${process.pid}`, {
    prefix: LogPrefix.SERVER,
    pid: process.pid
  });

  context.env.load(false);

  process.on("SIGINT", () => {
    void gracefulShutdown(context, context.httpServer, logger);
  });
  process.on("SIGTERM", () => {
    void gracefulShutdown(context, context.httpServer, logger);
  });
  process.on("uncaughtException", (error) => {
    void gracefulShutdown(context, context.httpServer, logger, error);
  });
  process.on("unhandledRejection", (reason) => {
    void gracefulShutdown(context, context.httpServer, logger, reason);
  });

  const api = new ServeApi(context);

  try {
    await api.init();
  } catch (error) {
    await gracefulShutdown(context, context.httpServer, logger, error);
  }
};

async function gracefulShutdown(
  ctx: ApiContext,
  server: Server | undefined,
  logger: PinoLogger,
  error?: unknown
) {
  if (shutdownInProgress) {
    logger.debug("Shutdown already in progress", { prefix: LogPrefix.SERVER });
    return;
  }
  shutdownInProgress = true;

  let exitCode = 0;
  const forceShutdownTimer = setTimeout(() => {
    process.stderr.write("Graceful shutdown timed out; forcing exit\n");
    process.exit(1);
  }, FORCE_SHUTDOWN_TIMEOUT_MS);
  forceShutdownTimer.unref();

  try {
    if (error !== undefined) {
      await ErrorController.resolveError(error, logger);
      logger.warn("Server closed due to error", {
        prefix: LogPrefix.SERVER,
        error: error instanceof Error ? error.message : String(error)
      });
      exitCode = 1;
    }

    if (!server) {
      logger.warn("Server not initiated", { prefix: LogPrefix.SERVER });
      exitCode = 1;
      return;
    }

    // Stop cron jobs
    try {
      const cronScheduler = container.resolve(CronSchedulerService);
      logger.info("Stopping cron scheduler...", {
        prefix: LogPrefix.CRON_SCHEDULER
      });
      await cronScheduler.stopAll();
    } catch (cronError) {
      logger.warn("Failed to stop cron scheduler", {
        prefix: LogPrefix.CRON_SCHEDULER,
        error: cronError instanceof Error ? cronError.message : String(cronError)
      });
    }

    // Stop metrics collection
    try {
      await container.resolve(MetricsService).stop();
    } catch {
      // Ignore
    }

    await ctx.io.close();
    await closeHttpServer(server);
    await ctx.db.disconnect();
    await RedisConfig.disconnect();
    logger.info("Server closed gracefully", { prefix: LogPrefix.SERVER });
  } catch (shutdownError) {
    exitCode = 1;
    logger.error("Server shutdown failed", {
      prefix: LogPrefix.SERVER,
      error: shutdownError instanceof Error ? shutdownError.message : String(shutdownError)
    });
  } finally {
    clearTimeout(forceShutdownTimer);
    await closeLogger(logger);
    process.exit(exitCode);
  }
}

async function closeHttpServer(server: Server): Promise<void> {
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

async function closeLogger(logger: PinoLogger): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      logger.close(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, LOGGER_CLOSE_TIMEOUT_MS);
        timeout.unref();
      })
    ]);
  } catch {
    // Process is exiting; there is no reliable logger left to report this.
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function setLoggers(logger: ILogger) {
  RedisConfig.setLogger(logger);
}

void main();
