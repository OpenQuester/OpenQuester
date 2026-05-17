import { LogTag } from "shared/logging/LogTag";

/**
 * Parsed log entry from unified.log.
 */
export interface LogEntry {
  /** Log level */
  level: string;
  /** ISO timestamp */
  timestamp: string;
  /** Log message */
  msg: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** User who triggered this log */
  userId?: number;
  /** Game context */
  gameId?: string;
  /** Socket ID */
  socketId?: string;
  /** Categorization tags */
  tags?: LogTag[];
  /** Additional structured metadata */
  meta?: Record<string, unknown>;
}

/**
 * Filter options for log retrieval.
 */
export interface LogFilter {
  /** Filter by log level(s) */
  levels?: string[];
  /** Filter by tag(s) - entry must have at least one matching tag */
  tags?: LogTag[];
  /** Filter by correlation ID */
  correlationId?: string;
  /** Filter by game ID */
  gameId?: string;
  /** Filter by user ID */
  userId?: number;
  /** Filter by time range - ISO timestamp, inclusive */
  since?: string;
  /** Filter by time range - ISO timestamp, inclusive */
  until?: string;
  /** Search in message text */
  search?: string;
  /** Number of lines to scan */
  limit?: number;
  /** Number of lines to skip before scanning */
  offset?: number;
}

/**
 * Result from log scan operation.
 */
export interface LogScanResult {
  /** Matching log entries within scanned window */
  logs: LogEntry[];
  /** Number of lines scanned */
  scanned: number;
  /** Number of lines skipped */
  skipped: number;
}
