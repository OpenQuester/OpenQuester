import { LogMeta } from "infrastructure/logger/LogMeta";
import { LogType } from "infrastructure/logger/LogType";
import { LogLevel, PerformanceLog } from "infrastructure/logger/PinoLogger";

export interface ILogger {
  info(msg: string, meta: LogMeta): void;
  debug(msg: string, meta: LogMeta): void;
  trace(msg: string, meta: LogMeta): void;
  warn(msg: string, meta: LogMeta): void;
  error(msg: string, meta: LogMeta): void;
  audit(msg: string, meta: LogMeta): void;
  performance(msg: string, meta: LogMeta): PerformanceLog;
  migration(msg: string, meta: LogMeta): void;
  log(type: LogType, msg: string, meta: LogMeta): void;
  checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel): boolean;
}
