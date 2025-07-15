import fs from "fs";
import path from "path";
import pino, { Logger as PinoLoggerType } from "pino";
import type SonicBoom from "sonic-boom";

import { ILogger } from "infrastructure/logger/ILogger";
import { LogType } from "infrastructure/logger/LogType";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

// Configuration for log file paths
export interface LoggerConfig {
  logPaths?: Partial<Record<LogType, string>>;
  pretty?: boolean;
  logLevel?: "trace" | "debug" | "info" | "warn" | "error";
}

// Type-safe log method mapping
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
// Only use Pino's supported log methods
type LogMethod = "info" | "debug" | "error" | "warn" | "trace";

const defaultLogDir = path.resolve(process.cwd(), "logs");
const defaultLogPaths: Record<LogType, string> = {
  [LogType.INFO]: path.join(defaultLogDir, "info.log"),
  [LogType.DEBUG]: path.join(defaultLogDir, "debug.log"),
  [LogType.ERROR]: path.join(defaultLogDir, "error.log"),
  [LogType.WARN]: path.join(defaultLogDir, "warn.log"),
  [LogType.AUDIT]: path.join(defaultLogDir, "audit.log"),
  [LogType.PERFORMANCE]: path.join(defaultLogDir, "performance.log"),
  [LogType.MIGRATION]: path.join(defaultLogDir, "migration.log"),
  [LogType.VERBOSE]: path.join(defaultLogDir, "trace.log"),
};

async function ensureLogDirs(paths: string[]): Promise<void> {
  const uniqueDirs = [
    ...new Set(paths.map((filePath) => path.dirname(filePath))),
  ];

  for (const dir of uniqueDirs) {
    try {
      await fs.promises.access(dir, fs.constants.F_OK);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        try {
          await fs.promises.mkdir(dir, { recursive: true });
        } catch (mkdirError) {
          throw new Error(
            `Failed to create log directory ${dir}: ${mkdirError}`
          );
        }
      } else {
        throw new Error(
          `Failed to access log directory ${dir}: ${err.message}`
        );
      }
    }
  }
}

export class PinoLogger implements ILogger {
  private readonly loggers: Map<LogType, PinoLoggerType> = new Map();
  private terminalLogger: PinoLoggerType | null = null;
  private fileStreams: SonicBoom[] = [];
  private initialized = false;
  private logLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  private constructor() {
    // Private constructor to enforce factory pattern
  }

  /**
   * Initialize the logger.
   * @param config LoggerConfig
   */
  static async init(config: LoggerConfig = {}): Promise<PinoLogger> {
    const logger = new PinoLogger();
    try {
      const mergedLogPaths = { ...defaultLogPaths, ...config.logPaths };
      const allPaths = Object.values(mergedLogPaths);
      await ensureLogDirs(allPaths);

      // Initialize terminal logger
      logger.initTerminalLogger(config);

      // Initialize file loggers
      logger.initFileLoggers(mergedLogPaths);

      logger.initialized = true;
      return logger;
    } catch (error) {
      throw new Error(`Failed to initialize PinoLogger: ${error}`);
    }
  }

  /**
   * Gracefully close all file logger streams.
   */
  public async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const stream of this.fileStreams) {
      if (typeof stream.end === "function") {
        closePromises.push(
          new Promise<void>((resolve) => {
            stream.end();
            resolve();
          })
        );
      }
    }

    await Promise.all(closePromises);
  }

  private initTerminalLogger(config: LoggerConfig): void {
    const logLevel = config.logLevel || "trace";

    if (config.pretty) {
      // Use pino-pretty for terminal output
      this.terminalLogger = pino({
        level: logLevel,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      });
    } else {
      // Plain terminal logger
      this.terminalLogger = pino({
        level: logLevel,
        formatters: {
          level: (label) => ({ level: label }),
        },
      });
    }
  }

  private initFileLoggers(logPaths: Record<LogType, string>): void {
    for (const [logType, filePath] of Object.entries(logPaths)) {
      const type = logType as LogType;
      try {
        const stream = pino.destination({
          dest: filePath,
          sync: false, // Always use async for better performance
          mkdir: true,
        });

        this.fileStreams.push(stream);

        const fileLogger = pino(
          {
            level: this.getPinoLevel(type),
            formatters: {
              level: (label) => ({ level: label }),
            },
          },
          stream
        );

        this.loggers.set(type, fileLogger);
      } catch (error) {
        console.error(
          `Failed to create logger for ${type} at ${filePath}:`,
          error
        );
      }
    }
  }

  private getPinoLevel(type: LogType): string {
    const levelMap: Record<LogType, string> = {
      [LogType.ERROR]: "error",
      [LogType.WARN]: "warn",
      [LogType.DEBUG]: "debug",
      [LogType.VERBOSE]: "trace",
      [LogType.INFO]: "info",
      [LogType.AUDIT]: "info",
      [LogType.PERFORMANCE]: "info",
      [LogType.MIGRATION]: "info",
    };

    return levelMap[type] || "info";
  }

  private getLogMethod(type: LogType): LogMethod {
    // Map LogType.VERBOSE to 'trace' for Pino
    switch (type) {
      case LogType.ERROR:
        return "error";
      case LogType.WARN:
        return "warn";
      case LogType.DEBUG:
        return "debug";
      case LogType.VERBOSE:
        return "trace";
      case LogType.INFO:
      case LogType.AUDIT:
      case LogType.PERFORMANCE:
      case LogType.MIGRATION:
        return "info";
      default:
        return "info";
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Logger not initialized. Call PinoLogger.init() first.");
    }
  }

  private sanitizeMessage(msg: unknown): string {
    if (typeof msg === "string") {
      return msg;
    }
    if (msg === null || msg === undefined) {
      return "";
    }
    return String(msg);
  }

  private sanitizeMeta(meta: unknown): Record<string, unknown> | undefined {
    if (!ValueUtils.isObject(meta)) {
      return undefined;
    }

    const metaObj = meta as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    let hasValidKeys = false;

    for (const [key, value] of Object.entries(metaObj)) {
      if (key !== "type" && value !== undefined) {
        sanitized[key] = value;
        hasValidKeys = true;
      }
    }

    return hasValidKeys ? sanitized : undefined;
  }

  public trace(msg: string, meta?: object): void {
    this.log(LogType.VERBOSE, msg, meta);
  }

  public debug(msg: string, meta?: object): void {
    this.log(LogType.DEBUG, msg, meta);
  }

  public info(msg: string, meta?: object): void {
    this.log(LogType.INFO, msg, meta);
  }

  public warn(msg: string, meta?: object): void {
    this.log(LogType.WARN, msg, meta);
  }

  public error(msg: string, meta?: object): void {
    this.log(LogType.ERROR, msg, meta);
  }

  public audit(msg: string, meta?: object): void {
    this.log(LogType.AUDIT, msg, meta);
  }

  public performance(msg: string, meta?: object): void {
    this.log(LogType.PERFORMANCE, msg, meta);
  }

  public migration(msg: string, meta?: object): void {
    const message = `Migration completed: ${msg}`;
    this.log(LogType.MIGRATION, message, meta);
  }

  public log(type: LogType, msg: unknown, meta?: unknown): void {
    this.ensureInitialized();

    // Map log type to effective log level for access control
    const typeToLevel: Record<LogType, LogLevel> = {
      [LogType.ERROR]: "error",
      [LogType.WARN]: "warn",
      [LogType.DEBUG]: "debug",
      [LogType.VERBOSE]: "trace",
      [LogType.INFO]: "info",
      [LogType.AUDIT]: "info", // audit, performance, migration are info-level
      [LogType.PERFORMANCE]: "info",
      [LogType.MIGRATION]: "info",
    };
    const messageLevel = typeToLevel[type] || "info";
    const envLevel =
      (process.env.LOG_LEVEL as LogLevel) || this.logLevel || "info";

    // Only log if message level is at or above env log level
    if (!this.checkAccess(envLevel, messageLevel)) {
      return;
    }

    // Extract prefix from meta if present
    let prefix: string | undefined;
    let metaObj: Record<string, unknown> | undefined = undefined;
    if (meta && typeof meta === "object" && meta !== null && "prefix" in meta) {
      const m = meta as Record<string, unknown>;
      if (typeof m.prefix === "string") {
        prefix = m.prefix;
      }
      // Remove prefix from meta for file logging
      metaObj = { ...m };
      delete metaObj.prefix;
    } else if (meta && typeof meta === "object") {
      metaObj = meta as Record<string, unknown>;
    }

    const sanitizedMsg = this.sanitizeMessage(msg);
    const sanitizedMeta = this.sanitizeMeta(metaObj);
    const method = this.getLogMethod(type);

    // Prepend prefix to message if present
    const msgWithPrefix = prefix ? `${prefix}${sanitizedMsg}` : sanitizedMsg;

    // Log to terminal - always just the message for clean output
    if (this.terminalLogger) {
      this.terminalLogger[method](msgWithPrefix);
    }

    // Log to file for this type (with meta if present)
    const fileLogger = this.loggers.get(type);
    if (fileLogger) {
      if (sanitizedMeta) {
        fileLogger[method](sanitizedMeta, msgWithPrefix);
      } else {
        fileLogger[method](msgWithPrefix);
      }
    }
  }

  public checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel) {
    // Order: trace < debug < info < warn < error
    const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];
    const logIndex = levels.indexOf(logLevel);
    const requiredLogIndex = levels.indexOf(requiredLogLevel);

    if (logIndex === -1 || requiredLogIndex === -1) {
      return false;
    }
    // Only log if the message is at or above the configured level
    return logIndex <= requiredLogIndex;
  }

  /**
   * Synchronous logger initialization for migration scripts and sync contexts.
   */
  public static initSync(config: LoggerConfig = {}): ILogger {
    const logger = new PinoLogger();
    const mergedLogPaths = { ...defaultLogPaths, ...config.logPaths };
    const allPaths = Object.values(mergedLogPaths);

    // Ensure log directories synchronously
    const uniqueDirs = [
      ...new Set(allPaths.map((filePath) => path.dirname(filePath))),
    ];

    /* eslint-disable node/no-sync */
    for (const dir of uniqueDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    /* eslint-enable node/no-sync */

    // Initialize terminal logger
    logger.initTerminalLogger(config);

    // Initialize file loggers synchronously
    for (const [logType, filePath] of Object.entries(mergedLogPaths)) {
      const type = logType as LogType;
      try {
        const stream = pino.destination({
          dest: filePath,
          sync: true, // Synchronous for migration scripts
          mkdir: true,
        });
        logger.fileStreams.push(stream);
        const fileLogger = pino(
          {
            level: logger.getPinoLevel(type),
            formatters: {
              level: (label) => ({ level: label }),
            },
          },
          stream
        );
        logger.loggers.set(type, fileLogger);
      } catch (error) {
        console.error(
          `Failed to create logger for ${type} at ${filePath}:`,
          error
        );
      }
    }

    logger.initialized = true;
    return logger;
  }
}
