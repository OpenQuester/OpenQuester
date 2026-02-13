import fs from "fs";
import os from "os";
import path from "path";

import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import type {
  PerformanceLog,
  LogLevel,
} from "infrastructure/logger/PinoLogger";
import type { LogMeta } from "infrastructure/logger/LogMeta";
import type { LogType } from "infrastructure/logger/LogType";
import { LogArchivalService } from "infrastructure/services/log/LogArchivalService";
import { setTestEnvDefaults } from "tests/utils/utils";

class TestLogger extends ILogger {
  info(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  debug(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  trace(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  warn(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  error(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  audit(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  performance(_msg: string, _meta: LogMeta): PerformanceLog {
    return { finish: () => undefined };
  }
  migration(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  log(_type: LogType, _msg: string, _meta: LogMeta): void {
    // no-op
  }
  checkAccess(_logLevel: LogLevel, _requiredLogLevel: LogLevel): boolean {
    return true;
  }
}

const buildTimestamp = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}-${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(
    date.getUTCSeconds()
  )}`;
};

describe("LogArchivalService", () => {
  const logger = new TestLogger();
  const originalCwd = process.cwd();
  let tempRoot: string;

  const logsDir = () => path.join(process.cwd(), "logs");
  const archivesDir = () => path.join(logsDir(), "archives");

  beforeAll(async () => {
    tempRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "oq-log-archival-")
    );
    process.chdir(tempRoot);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await fs.promises.rm(logsDir(), { recursive: true, force: true });
    await fs.promises.mkdir(logsDir(), { recursive: true });

    setTestEnvDefaults();
    process.env.LOG_ARCHIVE_ENABLED = "true";
    process.env.LOG_ARCHIVE_INTERVAL_DAYS = "7";
    process.env.LOG_ARCHIVE_RETENTION_DAYS = "90";

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);
  });

  it("archives logs and clears files", async () => {
    const infoPath = path.join(logsDir(), "info.log");
    const errorPath = path.join(logsDir(), "error.log");
    await fs.promises.writeFile(infoPath, "info-data");
    await fs.promises.writeFile(errorPath, "error-data");

    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    try {
      await fs.promises.access(archivesDir());
    } catch {
      throw new Error("Archive directory was not created");
    }
    const archiveEntries = await fs.promises.readdir(archivesDir());
    const archiveFiles = archiveEntries.filter((name) =>
      name.endsWith(".tar.gz")
    );
    expect(archiveFiles.length).toBe(1);

    const infoSize = (await fs.promises.stat(infoPath)).size;
    const errorSize = (await fs.promises.stat(errorPath)).size;
    expect(infoSize).toBe(0);
    expect(errorSize).toBe(0);

    const tempDirs = archiveEntries.filter((name) => name.startsWith("temp-"));
    expect(tempDirs.length).toBe(0);
  });

  it("skips archival when last archive is within interval", async () => {
    const infoPath = path.join(logsDir(), "info.log");
    await fs.promises.writeFile(infoPath, "still-here");

    await fs.promises.mkdir(archivesDir(), { recursive: true });
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const archiveName = `logs-${buildTimestamp(recent)}.tar.gz`;
    await fs.promises.writeFile(path.join(archivesDir(), archiveName), "dummy");

    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    const archiveEntries = await fs.promises.readdir(archivesDir());
    const archiveFiles = archiveEntries.filter((name) =>
      name.endsWith(".tar.gz")
    );
    expect(archiveFiles.length).toBe(1);

    const infoSize = (await fs.promises.stat(infoPath)).size;
    expect(infoSize).toBeGreaterThan(0);
  });

  it("archives logs when last archive is 8 days ago", async () => {
    const infoPath = path.join(logsDir(), "info.log");
    await fs.promises.writeFile(infoPath, "archive-me");

    await fs.promises.mkdir(archivesDir(), { recursive: true });
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const archiveName = `logs-${buildTimestamp(old)}.tar.gz`;
    await fs.promises.writeFile(path.join(archivesDir(), archiveName), "dummy");

    process.env.LOG_ARCHIVE_INTERVAL_DAYS = "1";
    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    const archiveEntries = await fs.promises.readdir(archivesDir());
    const archiveFiles = archiveEntries.filter((name) =>
      name.endsWith(".tar.gz")
    );
    expect(archiveFiles.length).toBe(2);

    const infoSize = (await fs.promises.stat(infoPath)).size;
    expect(infoSize).toBe(0);

    const tempDirs = archiveEntries.filter((name) => name.startsWith("temp-"));
    expect(tempDirs.length).toBe(0);
  });

  it("skips archival when disabled", async () => {
    const infoPath = path.join(logsDir(), "info.log");
    await fs.promises.writeFile(infoPath, "keep-me");

    process.env.LOG_ARCHIVE_ENABLED = "false";
    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    await expect(fs.promises.access(archivesDir())).rejects.toBeDefined();

    const infoSize = (await fs.promises.stat(infoPath)).size;
    expect(infoSize).toBeGreaterThan(0);
  });

  it("cleans up old archives based on retention days", async () => {
    const infoPath = path.join(logsDir(), "info.log");
    await fs.promises.writeFile(infoPath, "archive-now");

    await fs.promises.mkdir(archivesDir(), { recursive: true });
    const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await fs.promises.writeFile(
      path.join(archivesDir(), `logs-${buildTimestamp(stale)}.tar.gz`),
      "stale"
    );
    await fs.promises.writeFile(
      path.join(archivesDir(), `logs-${buildTimestamp(recent)}.tar.gz`),
      "recent"
    );

    process.env.LOG_ARCHIVE_INTERVAL_DAYS = "1";
    process.env.LOG_ARCHIVE_RETENTION_DAYS = "7";
    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    const archiveEntries = await fs.promises.readdir(archivesDir());
    const archiveFiles = archiveEntries.filter((name) =>
      name.endsWith(".tar.gz")
    );

    expect(
      archiveFiles.some((name) => name === `logs-${buildTimestamp(stale)}.tar.gz`)
    ).toBe(false);
    expect(
      archiveFiles.some((name) => name === `logs-${buildTimestamp(recent)}.tar.gz`)
    ).toBe(true);
    expect(archiveFiles.length).toBe(2);
  });

  it("does not create archive when no log files exist", async () => {
    const service = new LogArchivalService(logger);
    await service.checkAndArchive();

    const archiveEntries = await fs.promises.readdir(archivesDir());
    const archiveFiles = archiveEntries.filter((name) =>
      name.endsWith(".tar.gz")
    );
    const tempDirs = archiveEntries.filter((name) => name.startsWith("temp-"));

    expect(archiveFiles.length).toBe(0);
    expect(tempDirs.length).toBe(0);
  });
});
