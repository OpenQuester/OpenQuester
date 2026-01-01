import fs from "fs";
import path from "path";
import pino from "pino";
import type SonicBoom from "sonic-boom";

import { ILogger } from "infrastructure/logger/ILogger";
import { LogContextService } from "infrastructure/logger/LogContext";
import { LogType } from "infrastructure/logger/LogType";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

// Custom levels configuration for Pino
export const customLevels = {
  trace: 10, // LogType.VERBOSE
  debug: 20, // LogType.DEBUG
  info: 30, // LogType.INFO
  warn: 40, // LogType.WARN
  performance: 35, // LogType.PERFORMANCE (between info and warn)
  error: 50, // LogType.ERROR
  audit: 60, // LogType.AUDIT
  migration: 70, // LogType.MIGRATION
} as const;

export type CustomLevel = keyof typeof customLevels;

// Custom logger type that extends Pino's Logger with custom level methods
type CustomLogger = pino.Logger<CustomLevel>;

// Configuration for log file paths
export interface LoggerConfig {
  logPaths?: Partial<Record<LogType, string>>;
  pretty?: boolean;
  logLevel?: CustomLevel;
}

// Performance logging interface
export interface PerformanceLog {
  finish(additionalMeta?: object): void;
}

// Updated to use custom levels
export type LogLevel = CustomLevel;
// Custom log methods for our custom levels
type LogMethod = CustomLevel;

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

/**
 * Unified log file for multi-instance support.
 * All logs are written here with full metadata for retrieval via REST API.
 * TODO: For high-volume production, consider rotating logs or using external log aggregation.
 */
const UNIFIED_LOG_PATH = path.join(defaultLogDir, "unified.log");

/**
 * Export for LogReaderService.
 * Supports LOG_FILE_PATH env override for testing with isolated temp files.
 *
 * Use direct process.env access since Environment class depends on logger
 */
export const getUnifiedLogPath = (): string =>
  process.env.LOG_FILE_PATH || UNIFIED_LOG_PATH;

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

/**
 * Implementation of performance logging that tracks execution time
 */
class PerformanceLogImpl implements PerformanceLog {
  private readonly startTime: number;
  private readonly logger: PinoLogger;
  private readonly message: string;
  private readonly meta?: object;

  constructor(logger: PinoLogger, message: string, meta?: object) {
    this.startTime = Date.now();
    this.logger = logger;
    this.message = message;
    this.meta = meta;
  }

  public finish(additionalMeta?: object): void {
    const endTime = Date.now();
    const elapsedMs = endTime - this.startTime;

    // Merge finish-only metadata onto the original meta. In case of key conflicts,
    // `additionalMeta` takes precedence over the metadata captured at start.
    const mergedMeta = {
      operation: this.message,
      startedAt: this.startTime,
      finishedAt: endTime,
      durationMs: elapsedMs,
      ...(this.meta ?? {}),
      ...(additionalMeta ?? {}),
    };

    this.logger.log(
      LogType.PERFORMANCE,
      `${this.message} completed`,
      mergedMeta
    );
  }
}

export class PinoLogger implements ILogger {
  private readonly loggers: Map<LogType, CustomLogger> = new Map();
  private terminalLogger: CustomLogger | null = null;
  private unifiedLogger: CustomLogger | null = null;
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
      const allPaths = [...Object.values(mergedLogPaths), UNIFIED_LOG_PATH];
      await ensureLogDirs(allPaths);

      // Initialize terminal logger
      logger.initTerminalLogger(config);

      // Initialize file loggers
      logger.initFileLoggers(mergedLogPaths);

      // Initialize unified logger for multi-instance support
      logger.initUnifiedLogger();

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

    const pinoOptions = {
      level: logLevel,
      customLevels,
      useOnlyCustomLevels: true,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
    };

    if (config.pretty) {
      // Use pino-pretty for terminal output with custom level names
      this.terminalLogger = pino({
        ...pinoOptions,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
            customLevels:
              "trace:10,debug:20,info:30,performance:35,warn:40,error:50,audit:60,migration:70",
            useOnlyCustomProps: true,
            customColors:
              "trace:dim,debug:cyan,info:green,warn:yellow,error:red,audit:magenta,performance:blue,migration:brightWhite",
          },
        },
      }) as CustomLogger;
    } else {
      // Plain terminal logger
      this.terminalLogger = pino(pinoOptions) as CustomLogger;
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
            level: this.getCustomLevel(type),
            customLevels,
            useOnlyCustomLevels: true,
            formatters: {
              level: (label: string) => ({ level: label }),
            },
          },
          stream
        ) as CustomLogger;

        this.loggers.set(type, fileLogger);
      } catch (error) {
        console.error(
          `Failed to create logger for ${type} at ${filePath}:`,
          error
        );
      }
    }
  }

  /**
   * Initialize unified logger that writes all logs to a single file.
   * Used for multi-instance log retrieval via REST API.
   */
  private initUnifiedLogger(): void {
    try {
      const stream = pino.destination({
        dest: UNIFIED_LOG_PATH,
        sync: false,
        mkdir: true,
      });

      this.fileStreams.push(stream);

      // Unified logger accepts all levels
      this.unifiedLogger = pino(
        {
          level: "trace",
          customLevels,
          useOnlyCustomLevels: true,
          formatters: {
            level: (label: string) => ({ level: label }),
          },
        },
        stream
      ) as CustomLogger;
    } catch (error) {
      console.error(`Failed to create unified logger:`, error);
    }
  }

  /**
   * Get context metadata from LogContextService for auto-injection.
   */
  private getContextMeta(): Record<string, unknown> {
    const ctx = LogContextService.getContext();
    if (!ctx) return {};

    const meta: Record<string, unknown> = {
      correlationId: ctx.correlationId,
    };

    if (ctx.userId !== undefined) meta.userId = ctx.userId;
    if (ctx.gameId !== undefined) meta.gameId = ctx.gameId;
    if (ctx.socketId !== undefined) meta.socketId = ctx.socketId;
    if (ctx.tags.size > 0) meta.tags = Array.from(ctx.tags);

    return meta;
  }

  private getCustomLevel(type: LogType): CustomLevel {
    const levelMap: Record<LogType, CustomLevel> = {
      [LogType.ERROR]: "error",
      [LogType.WARN]: "warn",
      [LogType.DEBUG]: "debug",
      [LogType.VERBOSE]: "trace",
      [LogType.INFO]: "info",
      [LogType.AUDIT]: "audit",
      [LogType.PERFORMANCE]: "performance",
      [LogType.MIGRATION]: "migration",
    };

    return levelMap[type] || "info";
  }

  private getLogMethod(type: LogType): LogMethod {
    // Map LogType to custom level names
    return this.getCustomLevel(type);
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

  /**
   * Sanitize meta object for logging. Removes only 'prefix' property, keeps all others.
   * Returns undefined if no valid properties remain.
   */
  private sanitizeMeta(meta: unknown): Record<string, unknown> | undefined {
    if (!ValueUtils.isObject(meta)) {
      return undefined;
    }

    const metaObj = meta as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    let hasValidKeys = false;

    for (const [key, value] of Object.entries(metaObj)) {
      if (key !== "prefix" && value !== undefined) {
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

  public performance(msg: string, meta?: object): PerformanceLog {
    return new PerformanceLogImpl(this, msg, meta);
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
      [LogType.AUDIT]: "audit",
      [LogType.PERFORMANCE]: "performance",
      [LogType.MIGRATION]: "migration",
    };
    const messageLevel = typeToLevel[type] || "info";
    const envLevel =
      (process.env.LOG_LEVEL as LogLevel) || this.logLevel || "info";

    // Performance logs:
    // - never emit to terminal/stdout
    // - always write to performance log file regardless of LOG_LEVEL
    const shouldEmitToTerminal = type !== LogType.PERFORMANCE;
    const shouldBypassLevelGateForFile = type === LogType.PERFORMANCE;

    const hasAccessByLevel = this.checkAccess(envLevel, messageLevel);
    if (!hasAccessByLevel && !shouldBypassLevelGateForFile) {
      return;
    }

    // Auto-inject context from LogContextService
    const contextMeta = this.getContextMeta();

    // Extract prefix from meta if present, and remove it from metaObj
    let prefix: string | undefined;
    let metaObj: Record<string, unknown> | undefined = undefined;
    if (meta && typeof meta === "object" && meta !== null) {
      const m = meta as Record<string, unknown>;
      if (typeof m.prefix === "string") {
        prefix = m.prefix;
      }
      // Remove prefix from meta for logging, keep all other properties
      metaObj = { ...m };
      delete metaObj.prefix;
    }

    // Merge context meta with provided meta (provided meta takes precedence)
    const mergedMeta = { ...contextMeta, ...(metaObj ?? {}) };

    const sanitizedMsg = this.sanitizeMessage(msg);
    const sanitizedMeta = this.sanitizeMeta(mergedMeta);
    const method = this.getLogMethod(type);

    // Prepend prefix to message if present
    const msgWithPrefix = prefix ? `${prefix}${sanitizedMsg}` : sanitizedMsg;

    // Log to terminal - pass meta (without prefix) as first arg if present, then message
    if (this.terminalLogger && shouldEmitToTerminal && hasAccessByLevel) {
      if (sanitizedMeta) {
        this.terminalLogger[method](sanitizedMeta, msgWithPrefix);
      } else {
        this.terminalLogger[method](msgWithPrefix);
      }
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

    // Write to unified log file for REST API retrieval (multi-instance support)
    // Always write to unified log regardless of level (filtering done at read time)
    if (this.unifiedLogger) {
      const unifiedMeta = {
        ...sanitizedMeta,
        timestamp: new Date().toISOString(),
      };
      this.unifiedLogger[method](unifiedMeta, msgWithPrefix);
    }
  }

  public checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel) {
    // Custom level hierarchy: trace(10) < debug(20) < info(30) < performance(35) < warn(40) < error(50) < audit(60) < migration(70)
    const currentLevel = customLevels[logLevel];
    const requiredLevel = customLevels[requiredLogLevel];

    if (currentLevel === undefined || requiredLevel === undefined) {
      return false;
    }
    // Only log if the message level is at or above the configured level
    return currentLevel <= requiredLevel;
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
            level: logger.getCustomLevel(type),
            customLevels,
            useOnlyCustomLevels: true,
            formatters: {
              level: (label: string) => ({ level: label }),
            },
          },
          stream
        ) as CustomLogger;
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
