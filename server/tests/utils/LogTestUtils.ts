/* eslint-disable node/no-sync */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { LogTag } from "infrastructure/logger/LogTag";

/**
 * Structured log entry for test data generation.
 */
export interface TestLogEntry {
  level: string;
  msg: string;
  timestamp: string;
  correlationId?: string;
  userId?: number;
  gameId?: string;
  socketId?: string;
  tags?: LogTag[];
  [key: string]: unknown;
}

/**
 * Utility class for log-related test operations.
 * Manages temporary log files and provides helpers for creating test log data.
 */
export class LogTestUtils {
  private tempDir: string | null = null;
  private tempLogPath: string | null = null;
  private originalLogFilePath: string | undefined;

  /**
   * Initialize temporary log file environment.
   * Sets LOG_FILE_PATH env to point to temp file.
   * Call this in beforeAll().
   */
  public setup(): void {
    this.originalLogFilePath = process.env.LOG_FILE_PATH;
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "oq-log-test-"));
    this.tempLogPath = path.join(this.tempDir, "test-unified.log");
    process.env.LOG_FILE_PATH = this.tempLogPath;
  }

  /**
   * Clean up temp log file between tests.
   * Call this in afterEach().
   */
  public clearLogFile(): void {
    if (this.tempLogPath && fs.existsSync(this.tempLogPath)) {
      fs.unlinkSync(this.tempLogPath);
    }
  }

  /**
   * Full teardown - restore env and remove temp directory.
   * Call this in afterAll().
   */
  public teardown(): void {
    // Restore original env value
    if (this.originalLogFilePath !== undefined) {
      process.env.LOG_FILE_PATH = this.originalLogFilePath;
    } else {
      delete process.env.LOG_FILE_PATH;
    }

    // Clean up temp directory
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }

    this.tempDir = null;
    this.tempLogPath = null;
  }

  /**
   * Get the temp log file path.
   */
  public getLogPath(): string {
    if (!this.tempLogPath) {
      throw new Error("LogTestUtils not initialized. Call setup() first.");
    }
    return this.tempLogPath;
  }

  /**
   * Write log entries to the temp file.
   * Entries are written in order (oldest first).
   * Service reads from end (newest first).
   */
  public writeEntries(entries: TestLogEntry[]): void {
    if (!this.tempLogPath) {
      throw new Error("LogTestUtils not initialized. Call setup() first.");
    }
    const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.writeFileSync(this.tempLogPath, content, "utf8");
  }

  /**
   * Append log entries to existing file.
   */
  public appendEntries(entries: TestLogEntry[]): void {
    if (!this.tempLogPath) {
      throw new Error("LogTestUtils not initialized. Call setup() first.");
    }
    const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.appendFileSync(this.tempLogPath, content, "utf8");
  }

  /**
   * Create an empty log file.
   */
  public createEmptyFile(): void {
    if (!this.tempLogPath) {
      throw new Error("LogTestUtils not initialized. Call setup() first.");
    }
    fs.writeFileSync(this.tempLogPath, "", "utf8");
  }

  /**
   * Delete the log file (to test non-existent file scenario).
   */
  public deleteLogFile(): void {
    if (this.tempLogPath && fs.existsSync(this.tempLogPath)) {
      fs.unlinkSync(this.tempLogPath);
    }
  }

  /**
   * Generate sample log entries for testing.
   * Returns a diverse set of entries covering different levels, tags, etc.
   * Note: correlationIds must be valid UUID v4 format for API validation.
   */
  public static generateSampleEntries(): TestLogEntry[] {
    return [
      {
        level: "info",
        msg: "Server started",
        timestamp: "2025-01-01T08:00:00.000Z",
        tags: [LogTag.HTTP],
      },
      {
        level: "debug",
        msg: "Processing request",
        timestamp: "2025-01-01T09:00:00.000Z",
        correlationId: "11111111-1111-4111-8111-111111111111",
        userId: 1,
        tags: [LogTag.HTTP],
      },
      {
        level: "info",
        msg: "Game created",
        timestamp: "2025-01-01T10:00:00.000Z",
        correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        gameId: "ABCD",
        userId: 1,
        tags: [LogTag.GAME],
      },
      {
        level: "warn",
        msg: "Player timeout warning",
        timestamp: "2025-01-01T11:00:00.000Z",
        gameId: "ABCD",
        userId: 2,
        tags: [LogTag.GAME, LogTag.TIMER],
      },
      {
        level: "error",
        msg: "Database connection failed",
        timestamp: "2025-01-01T12:00:00.000Z",
        tags: [LogTag.DB],
      },
      {
        level: "info",
        msg: "User authenticated",
        timestamp: "2025-01-01T13:00:00.000Z",
        correlationId: "55555555-5555-4555-8555-555555555555",
        userId: 3,
        socketId: "socket-abc-123",
        tags: [LogTag.AUTH, LogTag.SOCKET],
      },
      {
        level: "audit",
        msg: "Admin accessed system logs",
        timestamp: "2025-01-01T14:00:00.000Z",
        userId: 1,
        tags: [LogTag.ADMIN],
      },
      {
        level: "info",
        msg: "Game ended successfully",
        timestamp: "2025-01-01T15:00:00.000Z",
        gameId: "EFGH",
        userId: 4,
        tags: [LogTag.GAME],
        customField: "extra-data",
      },
      {
        level: "debug",
        msg: "Cache invalidated",
        timestamp: "2025-01-01T16:00:00.000Z",
        tags: [LogTag.REDIS],
      },
      {
        level: "info",
        msg: "Scheduled cleanup completed",
        timestamp: "2025-01-01T17:00:00.000Z",
        tags: [LogTag.CRON],
      },
    ];
  }

  /**
   * Generate a single log entry with specified overrides.
   */
  public static createEntry(
    overrides: Partial<TestLogEntry> = {}
  ): TestLogEntry {
    return {
      level: "info",
      msg: "Test log message",
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate multiple entries with sequential timestamps.
   */
  public static generateSequentialEntries(
    count: number,
    baseTimestamp: string = "2025-01-01T10:00:00.000Z",
    intervalMinutes: number = 1
  ): TestLogEntry[] {
    const entries: TestLogEntry[] = [];
    const baseDate = new Date(baseTimestamp);

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(
        baseDate.getTime() + i * intervalMinutes * 60 * 1000
      ).toISOString();

      entries.push({
        level: "info",
        msg: `Entry ${i + 1}`,
        timestamp,
      });
    }

    return entries;
  }
}
