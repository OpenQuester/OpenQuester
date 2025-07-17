import { LogType } from "infrastructure/logger/LogType";
import { LogLevel, PerformanceLog } from "infrastructure/logger/PinoLogger";

export interface ILogger {
  info(msg: string, meta?: object): void;
  debug(msg: string, meta?: object): void;
  trace(msg: string, meta?: object): void;
  error(msg: string, meta?: object): void;
  warn(msg: string, meta?: object): void;
  audit(msg: string, meta?: object): void;
  performance(msg: string, meta?: object): PerformanceLog;
  migration(msg: string, meta?: object): void;
  log(type: LogType, msg: string, meta?: object): void;
  checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel): boolean;
}
