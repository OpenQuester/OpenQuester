import Joi from "joi";

import { LogTag } from "infrastructure/logger/LogTag";

/** Maximum characters allowed in search query (prevents regex DoS) */
const SEARCH_MAX_LENGTH = 100;
/** Default number of lines to scan per request */
const SCAN_LIMIT_DEFAULT = 100;
/** Maximum number of lines to scan per request */
const SCAN_LIMIT_MAX = 1000;
/** Minimum number of lines to scan per request */
const SCAN_LIMIT_MIN = 1;
/** Minimum lines to skip before scanning */
const OFFSET_MIN = 0;
/** Game ID format: 4 uppercase alphanumeric characters */
const GAME_ID_PATTERN = /^[A-Z0-9]{4}$/;

/**
 * Query params for GET /admin/api/system/logs endpoint.
 *
 * SCAN-BASED PAGINATION:
 * - `limit`: Number of log lines to SCAN (not results to return)
 * - `offset`: Number of lines to SKIP before starting scan
 * - Response may contain 0 to `limit` matching entries
 * - Use `hasMore` and `nextOffset` from response for pagination
 */
export interface LogQueryParams {
  /** Comma-separated log levels (e.g., "error,warn,info") */
  levels?: string;
  /** Comma-separated tags (e.g., "game,socket") */
  tags?: string;
  /** Filter by specific correlation ID */
  correlationId?: string;
  /** Filter by game ID */
  gameId?: string;
  /** Filter by user ID */
  userId?: number;
  /** ISO timestamp for start of time range */
  since?: string;
  /** ISO timestamp for end of time range */
  until?: string;
  /** Text search in message */
  search?: string;
  /** Number of lines to SCAN (default: 100, max: 1000) */
  limit?: number;
  /** Lines to SKIP before scanning (default: 0) */
  offset?: number;
}

const validLevels = ["trace", "debug", "info", "warn", "error", "audit"];
const validTags = Object.values(LogTag);

/**
 * Joi schema for log query params validation.
 *
 * Validates and transforms query params before processing.
 */
export const logQueryParamsScheme = Joi.object<LogQueryParams>({
  levels: Joi.string()
    .optional()
    .custom((value: string) => {
      const levels = value.split(",").map((l) => l.trim().toLowerCase());
      const invalid = levels.filter((l) => !validLevels.includes(l));
      if (invalid.length > 0) {
        throw new Error(`Invalid log levels: ${invalid.join(", ")}`);
      }
      return levels;
    }),

  tags: Joi.string()
    .optional()
    .custom((value: string) => {
      const tags = value.split(",").map((t) => t.trim().toLowerCase());
      const invalid = tags.filter((t) => !validTags.includes(t as LogTag));
      if (invalid.length > 0) {
        throw new Error(
          `Invalid tags: ${invalid.join(", ")}. Valid: ${validTags.join(", ")}`
        );
      }
      return tags as LogTag[];
    }),

  // UUID format for correlation ID (prevent injection)
  correlationId: Joi.string()
    .optional()
    .uuid({ version: "uuidv4" })
    .message("correlationId must be a valid UUID v4"),

  // Game ID is 4-char alphanumeric code
  gameId: Joi.string()
    .optional()
    .pattern(GAME_ID_PATTERN)
    .message("gameId must be a 4-character alphanumeric code"),

  userId: Joi.number().optional().integer().positive(),

  // ISO 8601 timestamps
  since: Joi.string().optional().isoDate(),
  until: Joi.string().optional().isoDate(),

  // Search text - limit length to prevent regex DoS
  search: Joi.string().optional().max(SEARCH_MAX_LENGTH),

  // Scan-based pagination
  limit: Joi.number()
    .optional()
    .integer()
    .min(SCAN_LIMIT_MIN)
    .max(SCAN_LIMIT_MAX)
    .default(SCAN_LIMIT_DEFAULT),
  offset: Joi.number().optional().integer().min(OFFSET_MIN).default(OFFSET_MIN),
});
