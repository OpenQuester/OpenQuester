import { statSync } from "fs";
import { access, constants, open } from "fs/promises";

import { LogTag } from "infrastructure/logger/LogTag";
import { getUnifiedLogPath } from "infrastructure/logger/PinoLogger";

/** Default chunk size for reading log file from end (64KB) */
const READ_CHUNK_SIZE = 64 * 1024;

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
  /** Number of lines to SCAN from log file (default: 100, max: 1000) */
  limit?: number;
  /** Number of lines to SKIP before starting scan (default: 0) */
  offset?: number;
}

/**
 * Result from log scan operation
 */
export interface LogScanResult {
  /** Matching log entries within scanned window */
  logs: LogEntry[];
  /** Number of lines scanned */
  scanned: number;
  /** Number of lines skipped (offset) */
  skipped: number;
}

/**
 * Service to read and filter logs from the unified log file.
 * Supports multi-instance deployments by reading from a shared log file.
 *
 * Follows Single Responsibility: only reads/filters logs, doesn't write.
 *
 * SCAN-BASED PAGINATION:
 * - `limit` = number of lines to scan (not results to return)
 * - `offset` = number of lines to skip before scanning
 * - Returns all matches within scan window (may be 0 to limit)
 * - Fast, predictable response time regardless of filter strictness
 *
 * TODO: Production scaling improvements:
 * 1. Log rotation: Implement date-based rotation (e.g., unified-2025-01-01.log)
 *    and update readLogs() to scan multiple files.
 * 2. Indexing: For >100k entries, add Redis-based index for correlationId/gameId.
 * 3. External storage: For enterprise scale, integrate with Elasticsearch/Loki.
 * 4. Streaming: Add WebSocket endpoint for real-time log tailing.
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
   * Read logs using scan-based pagination.
   *
   * SCAN STRATEGY (not "find until N matches"):
   * - `limit`: Number of lines to SCAN from the file (default: 100)
   * - `offset`: Number of lines to SKIP before starting scan
   * - Returns all matching entries within the scanned window
   *
   * This ensures predictable, fast response times regardless of filter strictness.
   * With rare filters (e.g., specific correlationId), you may get fewer results,
   * but the scan completes quickly. Client can request next page to find more.
   *
   * Memory usage: O(limit) - only scanned lines in memory.
   * Time complexity: O(offset + limit) - skips offset, scans limit lines.
   */
  async readLogs(filter: LogFilter = {}): Promise<LogScanResult> {
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    if (!(await this.fileExists())) {
      return { logs: [], scanned: 0, skipped: 0 };
    }

    const entries: LogEntry[] = [];
    let linesScanned = 0;
    let linesSkipped = 0;

    // Read file from end in chunks
    for await (const line of this.readLinesFromEnd()) {
      if (!line.trim()) continue;

      // Skip `offset` lines first
      if (linesSkipped < offset) {
        linesSkipped++;
        continue;
      }

      // Stop after scanning `limit` lines
      if (linesScanned >= limit) {
        break;
      }

      linesScanned++;

      try {
        const entry = this.parseLine(line);
        if (entry && this.matchesFilter(entry, filter)) {
          entries.push(entry);
        }
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return {
      logs: entries,
      scanned: linesScanned,
      skipped: linesSkipped,
    };
  }

  /**
   * Async generator that yields lines from file end to start.
   * Reads file in chunks for memory efficiency.
   *
   * This enables streaming pagination without loading entire file.
   */
  private async *readLinesFromEnd(): AsyncGenerator<string> {
    const stats = statSync(this.logPath);
    const fileSize = stats.size;

    if (fileSize === 0) return;

    const fd = await open(this.logPath, "r");

    try {
      let position = fileSize;
      let leftover = "";

      while (position > 0) {
        // Calculate chunk to read
        const chunkSize = Math.min(READ_CHUNK_SIZE, position);
        position -= chunkSize;

        // Read chunk
        const buffer = Buffer.alloc(chunkSize);
        await fd.read(buffer, 0, chunkSize, position);
        const chunk = buffer.toString("utf8") + leftover;

        // Split into lines
        const lines = chunk.split("\n");

        // First element may be partial line (continues from previous chunk)
        leftover = lines.shift() || "";

        // Yield lines in reverse order (newest first)
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line) {
            yield line;
          }
        }
      }

      // Yield any remaining content from the start of file
      if (leftover.trim()) {
        yield leftover.trim();
      }
    } finally {
      await fd.close();
    }
  }

  /**
   * Get total count of logs matching filter (for pagination info).
   *
   * Note: This still requires full scan. For production, consider:
   * - Caching count with short TTL (30s)
   * - Approximate counts from periodic sampling
   * - Skip count endpoint entirely (use "hasMore" flag instead)
   */
  async countLogs(filter: LogFilter = {}): Promise<number> {
    if (!(await this.fileExists())) {
      return 0;
    }

    let count = 0;

    for await (const line of this.readLinesFromEnd()) {
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
