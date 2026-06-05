import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type LogFileReader } from "shared/logging/LogFileReader";
import { type LogEntry, type LogFilter, type LogScanResult } from "shared/logging/LogReaderTypes";
import { LogTag } from "shared/logging/LogTag";

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
 *    and update readLogs() to scan multiple files. -> **DONE**
 * 2. Indexing: For >100k entries, add Redis-based index for correlationId/gameId.
 * 3. External storage: For enterprise scale, integrate with Elasticsearch/Loki.
 * 4. Streaming: Add WebSocket endpoint for real-time log tailing.
 */
@singleton()
export class LogReaderService {
  constructor(@inject(DI_TOKENS.LogFileReader) private readonly logFileReader: LogFileReader) {
    //
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

    if (!(await this.logFileReader.exists())) {
      return { logs: [], scanned: 0, skipped: 0 };
    }

    const entries: LogEntry[] = [];
    let linesScanned = 0;
    let linesSkipped = 0;

    // Read file from end in chunks
    for await (const line of this.logFileReader.readLinesFromEnd()) {
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
      skipped: linesSkipped
    };
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
      timestamp: String(parsed.timestamp || parsed.time || new Date().toISOString()),
      msg: String(parsed.msg)
    };

    // Optional context fields
    if (parsed.correlationId) entry.correlationId = String(parsed.correlationId);
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
      "hostname"
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
