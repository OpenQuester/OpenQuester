import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Structured log metadata.
 */
export interface LogMeta extends Record<string, unknown> {
  prefix: LogPrefix;
}
