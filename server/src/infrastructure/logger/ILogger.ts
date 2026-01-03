import type { LogMeta } from "infrastructure/logger/LogMeta";
import type { LogType } from "infrastructure/logger/LogType";
import type {
  LogLevel,
  PerformanceLog,
} from "infrastructure/logger/PinoLogger";

export abstract class ILogger {
  abstract info(msg: string, meta: LogMeta): void;
  abstract debug(msg: string, meta: LogMeta): void;
  abstract trace(msg: string, meta: LogMeta): void;
  abstract warn(msg: string, meta: LogMeta): void;
  abstract error(msg: string, meta: LogMeta): void;
  abstract audit(msg: string, meta: LogMeta): void;
  abstract performance(msg: string, meta: LogMeta): PerformanceLog;
  abstract migration(msg: string, meta: LogMeta): void;
  abstract log(type: LogType, msg: string, meta: LogMeta): void;
  abstract checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel): boolean;
}
