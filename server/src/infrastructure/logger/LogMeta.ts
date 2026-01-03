/**
 * Structured log metadata.
 *
 * `prefix` is required to enforce consistent subsystem categorization.
 */
import { LogPrefix } from "infrastructure/logger/LogPrefix";

export interface LogMeta extends Record<string, unknown> {
  prefix: LogPrefix;
}
