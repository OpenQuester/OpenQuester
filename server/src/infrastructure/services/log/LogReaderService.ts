import { createReadStream } from "fs";
import { access, constants } from "fs/promises";
import readline from "readline";

import { LogTag } from "infrastructure/logger/LogTag";
import { getUnifiedLogPath } from "infrastructure/logger/PinoLogger";

/**
 * Parsed log entry from unified.log
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
  /** Additional structured metadata (everything else) */
  meta?: Record<string, unknown>;
}

/**
 * Filter options for log retrieval
 */
export interface LogFilter {
  /** Filter by log level(s) */
  levels?: string[];
  /** Filter by tag(s) - entry must have at least one matching tag */
  tags?: LogTag[];
  /** Filter by correlation ID (exact match) */
  correlationId?: string;
  /** Filter by game ID (exact match) */
  gameId?: string;
  /** Filter by user ID */
  userId?: number;
  /** Filter by time range - ISO timestamp (inclusive) */
  since?: string;
  /** Filter by time range - ISO timestamp (inclusive) */
  until?: string;
  /** Search in message text (case-insensitive) */
  search?: string;
  /** Maximum number of entries to return (default: 100) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

/**
 * Service to read and filter logs from the unified log file.
 * Supports multi-instance deployments by reading from a shared log file.
 *
 * Follows Single Responsibility: only reads/filters logs, doesn't write.
 *
 * TODO: Production scaling improvements:
 * 1. Log rotation: Implement date-based rotation (e.g., unified-2025-01-01.log)
 *    and update readLogs() to scan multiple files. Consider using winston-daily-rotate-file
 *    or a custom RotatingFileTransport.
 * 2. Indexing: For >100k entries, add Redis-based index:
 *    - Store correlationId → [lineNumbers] mapping
 *    - Store gameId → [lineNumbers] mapping
 *    - Rebuild index on rotation
 * 3. External storage: For enterprise scale, integrate with:
 *    - Elasticsearch (full-text search, aggregations)
 *    - Grafana Loki (label-based queries, cost-effective)
 *    - AWS CloudWatch Logs (if on AWS)
 * 4. Streaming: Add WebSocket endpoint using readline + EventEmitter to
 *    tail -f the log file and emit new entries to connected admins.
 */
export class LogReaderService {
  private readonly logPath: string;

  constructor() {
    this.logPath = getUnifiedLogPath();
  }

  /**
   * Check if log file exists (async to avoid blocking).
   */
  private async fileExists(): Promise<boolean> {
    try {
      await access(this.logPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read logs with filters applied.
   * Reads file in reverse order (newest first).
   *
   * TODO: Performance optimization for large files (>10MB):
   * - Current: O(n) full scan, loads all matching entries into memory
   * - Option A: Read file in reverse using fs.read() with byte offsets
   * - Option B: Maintain line offset index in Redis for fast seeks
   * - Option C: Use external log aggregator that supports efficient queries
   * For now, acceptable for admin debugging use case (<1000 req/day).
   */
  async readLogs(filter: LogFilter = {}): Promise<LogEntry[]> {
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    if (!(await this.fileExists())) {
      return [];
    }

    const entries: LogEntry[] = [];
    let matchCount = 0;
    let skipCount = 0;

    const fileStream = createReadStream(this.logPath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Collect all matching entries first
    // TODO: Memory optimization - for files >50MB, implement streaming pagination:
    // 1. Track byte offset of each match
    // 2. On subsequent page requests, seek to stored offset
    // 3. This avoids re-scanning entire file for each page

    const allMatching: LogEntry[] = [];

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = this.parseLine(line);
        if (entry && this.matchesFilter(entry, filter)) {
          allMatching.push(entry);
        }
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    // Return in reverse order (newest first) with pagination
    const reversed = allMatching.reverse();
    for (const entry of reversed) {
      if (skipCount < offset) {
        skipCount++;
        continue;
      }

      entries.push(entry);
      matchCount++;

      if (matchCount >= limit) break;
    }

    return entries;
  }

  /**
   * Get total count of logs matching filter (for pagination).
   *
   * TODO: Caching strategy for count queries:
   * - Cache key: hash of filter params (levels, tags, correlationId, etc.)
   * - TTL: 30 seconds (logs change frequently)
   * - Invalidate on log rotation
   * - Use Redis INCR to track approximate counts per minute
   */
  async countLogs(filter: LogFilter = {}): Promise<number> {
    if (!(await this.fileExists())) {
      return 0;
    }

    let count = 0;

    const fileStream = createReadStream(this.logPath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = this.parseLine(line);
        if (entry && this.matchesFilter(entry, filter)) {
          count++;
        }
      } catch {
        continue;
      }
    }

    return count;
  }

  /**
   * Parse a JSON log line into LogEntry
   */
  private parseLine(line: string): LogEntry | null {
    const parsed = JSON.parse(line) as Record<string, unknown>;

    // Required fields
    if (!parsed.level || !parsed.msg) {
      return null;
    }

    const entry: LogEntry = {
      level: String(parsed.level),
      timestamp: String(
        parsed.timestamp || parsed.time || new Date().toISOString()
      ),
      msg: String(parsed.msg),
    };

    // Optional context fields
    if (parsed.correlationId)
      entry.correlationId = String(parsed.correlationId);
    if (parsed.userId !== undefined) entry.userId = Number(parsed.userId);
    if (parsed.gameId) entry.gameId = String(parsed.gameId);
    if (parsed.socketId) entry.socketId = String(parsed.socketId);
    if (Array.isArray(parsed.tags)) entry.tags = parsed.tags as LogTag[];

    // Collect remaining fields as meta
    const meta: Record<string, unknown> = {};
    const knownKeys = new Set([
      "level",
      "msg",
      "timestamp",
      "time",
      "correlationId",
      "userId",
      "gameId",
      "socketId",
      "tags",
      "pid",
      "hostname",
    ]);

    for (const [key, value] of Object.entries(parsed)) {
      if (!knownKeys.has(key)) {
        meta[key] = value;
      }
    }

    if (Object.keys(meta).length > 0) {
      entry.meta = meta;
    }

    return entry;
  }

  /**
   * Check if entry matches all filter criteria
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    // Level filter
    if (filter.levels?.length) {
      if (!filter.levels.includes(entry.level)) {
        return false;
      }
    }

    // Tag filter (entry must have at least one matching tag)
    if (filter.tags?.length) {
      const entryTags = entry.tags || [];
      if (!filter.tags.some((t) => entryTags.includes(t))) {
        return false;
      }
    }

    // Correlation ID filter (exact match)
    if (filter.correlationId) {
      if (entry.correlationId !== filter.correlationId) {
        return false;
      }
    }

    // Game ID filter (exact match)
    if (filter.gameId) {
      if (entry.gameId !== filter.gameId) {
        return false;
      }
    }

    // User ID filter
    if (filter.userId !== undefined) {
      if (entry.userId !== filter.userId) {
        return false;
      }
    }

    // Time range filter
    if (filter.since) {
      if (entry.timestamp < filter.since) {
        return false;
      }
    }
    if (filter.until) {
      if (entry.timestamp > filter.until) {
        return false;
      }
    }

    // Text search filter (case-insensitive)
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const messageLower = entry.msg.toLowerCase();
      if (!messageLower.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }
}
