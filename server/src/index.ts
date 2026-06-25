// reflect-metadata must be imported at the very top for tsyringe decorators
import "reflect-metadata";

import { instrument } from "@socket.io/admin-ui";
import { createAdapter } from "@socket.io/redis-adapter";
import { hashSync } from "bcryptjs";
import express from "express";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";

import { ApiContext } from "shared/context/ApiContext";
import { ErrorController } from "domain/errors/ErrorController";
import { Environment, EnvType } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { Database } from "infrastructure/database/Database";
import { AppDataSource } from "infrastructure/database/DataSource";
import { TypeOrmLoggerAdapter } from "infrastructure/database/TypeOrmLoggerAdapter";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { ServeApi } from "./ServeApi";

// This is the whole-process last resort. It must exceed the sum of individual
// cleanup budgets inside ServeApi plus Redis/logger reporting overhead.
const FORCE_SHUTDOWN_TIMEOUT_MS = 30000;
let shutdownPromise: Promise<void> | undefined;

interface ShutdownResources {
  context: ApiContext;
  api: ServeApi | undefined;
  logger: PinoLogger;
  trigger: unknown | undefined;
}

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

  const api = new ServeApi(context);

  process.on("SIGINT", () => {
    void gracefulShutdown({ context, api, logger, trigger: undefined });
  });
  process.on("SIGTERM", () => {
    void gracefulShutdown({ context, api, logger, trigger: undefined });
  });
  process.on("uncaughtException", (error) => {
    void gracefulShutdown({ context, api, logger, trigger: error });
  });
  process.on("unhandledRejection", (reason) => {
    void gracefulShutdown({ context, api, logger, trigger: reason });
  });

  try {
    await api.init();
  } catch (error) {
    await gracefulShutdown({ context, api, logger, trigger: error });
  }
};

function gracefulShutdown(resources: ShutdownResources): Promise<void> {
  if (shutdownPromise) {
    resources.logger.debug("Shutdown already in progress", { prefix: LogPrefix.SERVER });
    return shutdownPromise;
  }

  shutdownPromise = runShutdown(resources);
  return shutdownPromise;
}

async function runShutdown(resources: ShutdownResources): Promise<void> {
  const { api, context, logger, trigger } = resources;
  const errors: Error[] = [];
  let exitCode = trigger === undefined ? 0 : 1;

  const forceShutdownTimer = setTimeout(() => {
    process.stderr.write(
      `Graceful shutdown timed out after ${FORCE_SHUTDOWN_TIMEOUT_MS}ms; forcing exit\n`
    );
    process.exit(1);
  }, FORCE_SHUTDOWN_TIMEOUT_MS);
  forceShutdownTimer.unref();

  try {
    if (trigger !== undefined) {
      const triggerError = toLifecycleError("Shutdown trigger", trigger);
      errors.push(triggerError);

      await collectFailure(errors, logger, "Shutdown trigger reporting", async () => {
        await ErrorController.resolveError(trigger, logger);
        logger.warn("Server shutting down due to error", {
          prefix: LogPrefix.SERVER,
          error: triggerError.message
        });
      });
    }

    await collectFailure(errors, logger, "ServeApi shutdown", async () => {
      if (api) {
        await api.shutdown();
      }
    });

    await collectFailure(errors, logger, "Database disconnect", async () => {
      await context.db.disconnect();
    });

    await collectFailure(errors, logger, "RedisConfig disconnect", async () => {
      await RedisConfig.disconnect();
    });

    await collectFailure(errors, logger, "DI container cleanup", async () => {
      container.clearInstances();
    });

    if (errors.length > (trigger === undefined ? 0 : 1)) {
      exitCode = 1;
    }

    if (errors.length > 0) {
      const shutdownError = new AggregateError(errors, "Server shutdown completed with failures");
      logger.error(shutdownError.message, {
        prefix: LogPrefix.SERVER,
        error: flattenErrorMessages(shutdownError).join("\n")
      });
    } else {
      logger.info("Server closed gracefully", { prefix: LogPrefix.SERVER });
    }
  } finally {
    clearTimeout(forceShutdownTimer);

    try {
      logger.info("Closing logger", { prefix: LogPrefix.SERVER });
      await logger.close();
    } catch (error) {
      exitCode = 1;
      process.stderr.write(`${toLifecycleError("Logger close", error).message}\n`);
    }

    process.exit(exitCode);
  }
}

async function collectFailure(
  errors: Error[],
  logger: PinoLogger,
  label: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const cleanupError = toLifecycleError(label, error);
    logger.error(cleanupError.message, {
      prefix: LogPrefix.SERVER,
      error: cleanupError.message
    });
    errors.push(cleanupError);
  }
}

function toLifecycleError(label: string, error: unknown): Error {
  const cause = error instanceof Error ? error : undefined;
  const message = cause?.message ?? String(error);

  return new Error(`${label} failed: ${message}`, { cause });
}

function flattenErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const visit = (current: unknown): void => {
    if (current instanceof AggregateError) {
      messages.push(current.message);
      for (const nested of current.errors) {
        visit(nested);
      }
      visit(current.cause);
      return;
    }

    if (current instanceof Error) {
      messages.push(current.message);
      visit(current.cause);
      return;
    }

    if (current !== undefined) {
      messages.push(String(current));
    }
  };

  visit(error);
  return messages;
}

function setLoggers(logger: ILogger): void {
  RedisConfig.setLogger(logger);
}

void main();
