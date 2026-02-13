import archiver from "archiver";
import fs from "fs";
import path from "path";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { DAY_MS } from "domain/constants/time";
import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

const ARCHIVE_FILENAME_REGEX =
  /^logs-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.tar\.gz$/;

interface LogArchivalConfig {
  enabled: boolean;
  intervalDays: number;
  retentionDays: number;
}

interface ArchiveResult {
  archivePath: string;
  archivedFiles: number;
  totalBytes: number;
}

/**
 * Periodically archives current log files and removes old archive files.
 *
 * The service is invoked externally (e.g., daily cron). It archives only when
 * the configured interval since the last archive has elapsed, and then applies
 * retention-based cleanup for old archives.
 */
@singleton()
export class LogArchivalService {
  private readonly logPrefix = LogPrefix.LOG_ARCHIVAL;
  private readonly env: Environment;

  constructor(@inject(DI_TOKENS.Logger) private readonly logger: ILogger) {
    this.env = Environment.getInstance(this.logger);
  }

  public async checkAndArchive(): Promise<void> {
    const config = this.getConfig();

    if (!config.enabled) {
      this.logger.warn("Log archival is disabled", {
        prefix: this.logPrefix,
      });
      return;
    }

    await this.ensureArchivesDir();

    const lastArchiveDate = await this.getLastArchiveDate();
    const shouldArchive = this.shouldArchive(lastArchiveDate, config);

    if (!shouldArchive) {
      const daysSinceLast = lastArchiveDate
        ? this.daysSince(lastArchiveDate)
        : null;

      this.logger.info("Log archival skipped", {
        prefix: this.logPrefix,
        daysSinceLastArchive: daysSinceLast,
        intervalDays: config.intervalDays,
        lastArchiveDate: lastArchiveDate?.toISOString(),
      });
      return;
    }

    this.logger.info("Log archival triggered", {
      prefix: this.logPrefix,
      lastArchiveDate: lastArchiveDate?.toISOString(),
      intervalDays: config.intervalDays,
    });

    const result = await this.archiveCurrentLogs();

    if (result) {
      this.logger.info("Log archive created", {
        prefix: this.logPrefix,
        archivePath: result.archivePath,
        archivedFiles: result.archivedFiles,
        totalBytes: result.totalBytes,
      });
    }

    await this.cleanupOldArchives(config.retentionDays);
  }

  private getConfig(): LogArchivalConfig {
    return {
      enabled: this.env.LOG_ARCHIVE_ENABLED,
      intervalDays: this.env.LOG_ARCHIVE_INTERVAL_DAYS,
      retentionDays: this.env.LOG_ARCHIVE_RETENTION_DAYS,
    };
  }

  private async ensureArchivesDir(): Promise<void> {
    await fs.promises.mkdir(this.getArchivesDir(), { recursive: true });
  }

  private async getLastArchiveDate(): Promise<Date | null> {
    const archiveFiles = await this.listArchiveFiles();
    let latest: Date | null = null;

    for (const file of archiveFiles) {
      const parsed = this.parseArchiveDate(file);
      if (!parsed) continue;
      if (!latest || parsed.getTime() > latest.getTime()) {
        latest = parsed;
      }
    }

    return latest;
  }

  private shouldArchive(
    lastArchiveDate: Date | null,
    config: LogArchivalConfig
  ): boolean {
    if (!lastArchiveDate) {
      return true;
    }

    const daysSinceLast = this.daysSince(lastArchiveDate);
    return daysSinceLast >= config.intervalDays;
  }

  private daysSince(date: Date): number {
    const diffMs = Date.now() - date.getTime();
    return diffMs / DAY_MS;
  }

  private async archiveCurrentLogs(): Promise<ArchiveResult | null> {
    const logFiles = await this.listLogFiles();

    if (logFiles.length === 0) {
      this.logger.info("No log files found to archive", {
        prefix: this.logPrefix,
      });
      return null;
    }

    const timestamp = this.buildTimestamp();
    const tempDir = path.join(this.getArchivesDir(), `temp-${timestamp}`);
    const archiveName = `logs-${timestamp}.tar.gz`;
    const archivePath = path.join(this.getArchivesDir(), archiveName);

    await fs.promises.mkdir(tempDir, { recursive: true });

    this.logger.info("Log archival started", {
      prefix: this.logPrefix,
      archivePath,
      logFiles: logFiles.length,
    });

    let totalBytes = 0;

    try {
      let copied = 0;
      for (const filePath of logFiles) {
        const fileName = path.basename(filePath);
        const destPath = path.join(tempDir, fileName);
        await fs.promises.copyFile(filePath, destPath);

        copied++;
        if (copied % 5 === 0 || copied === logFiles.length) {
          this.logger.info("Log archival progress: files copied", {
            prefix: this.logPrefix,
            copied,
            total: logFiles.length,
          });
        }

        const stats = await fs.promises.stat(filePath);
        totalBytes += stats.size;
      }

      this.logger.info("Log archival progress: creating archive", {
        prefix: this.logPrefix,
        archivePath,
      });

      await this.createArchiveFromDir(tempDir, archivePath);

      this.logger.info("Log archival progress: archive created", {
        prefix: this.logPrefix,
        archivePath,
      });

      this.logger.info("Log archival progress: truncating log files", {
        prefix: this.logPrefix,
        total: logFiles.length,
      });

      await this.truncateLogFiles(logFiles);

      return {
        archivePath,
        archivedFiles: logFiles.length,
        totalBytes,
      };
    } catch (error) {
      try {
        await fs.promises.rm(archivePath, { force: true });
      } catch (archiveCleanupError) {
        this.logger.warn("Failed to remove partial log archive file", {
          prefix: this.logPrefix,
          archivePath,
          error:
            archiveCleanupError instanceof Error
              ? archiveCleanupError.message
              : String(archiveCleanupError),
        });
      }

      this.logger.error("Log archival failed", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    } finally {
      this.logger.info("Log archival progress: cleaning temp directory", {
        prefix: this.logPrefix,
        tempDir,
      });
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn("Failed to remove archival temp directory", {
          prefix: this.logPrefix,
          tempDir,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }
    }
  }

  private async createArchiveFromDir(
    sourceDir: string,
    archivePath: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver("tar", {
        gzip: true,
        gzipOptions: { level: 9 },
      });

      output.on("close", () => resolve());
      output.on("error", (error) => reject(error));
      archive.on("warning", (warning) => {
        this.logger.warn("Log archival warning", {
          prefix: this.logPrefix,
          warning: warning.message,
        });
      });
      archive.on("error", (error) => reject(error));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      void archive.finalize();
    });
  }

  private async truncateLogFiles(logFiles: string[]): Promise<void> {
    let truncated = 0;

    for (const filePath of logFiles) {
      try {
        await fs.promises.writeFile(filePath, "", { flag: "w" });
        truncated++;
      } catch (error) {
        this.logger.warn("Failed to truncate log file", {
          prefix: this.logPrefix,
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info("Log files truncated after archive", {
      prefix: this.logPrefix,
      truncated,
      total: logFiles.length,
    });
  }

  private async cleanupOldArchives(retentionDays: number): Promise<void> {
    const archiveFiles = await this.listArchiveFiles();
    const cutoff = Date.now() - retentionDays * DAY_MS;
    let removed = 0;

    for (const file of archiveFiles) {
      const archiveDate = this.parseArchiveDate(file);
      if (!archiveDate) continue;

      if (archiveDate.getTime() < cutoff) {
        const filePath = path.join(this.getArchivesDir(), file);
        try {
          await fs.promises.unlink(filePath);
          removed++;
        } catch (error) {
          this.logger.warn("Failed to delete old archive", {
            prefix: this.logPrefix,
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (removed > 0) {
      this.logger.info("Old log archives deleted", {
        prefix: this.logPrefix,
        removed,
        retentionDays,
      });
    }
  }

  private async listArchiveFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.getArchivesDir(), {
        withFileTypes: true,
      });

      return entries
        .filter(
          (entry) => entry.isFile() && ARCHIVE_FILENAME_REGEX.test(entry.name)
        )
        .map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      this.logger.warn("Failed to list log archives", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async listLogFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.getLogsDir(), {
        withFileTypes: true,
      });

      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
        .map((entry) => path.join(this.getLogsDir(), entry.name));
    } catch (error) {
      this.logger.warn("Failed to list log files", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private parseArchiveDate(filename: string): Date | null {
    const match = ARCHIVE_FILENAME_REGEX.exec(filename);
    if (!match) return null;
    if (match.length !== 7) return null;

    // Example: logs-2024-06-15-03-00-00.tar.gz
    const [year, month, day, hour, minute, second] = match
      .slice(1)
      .map((value) => Number(value));

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private buildTimestamp(): string {
    const now = new Date();

    const pad = (value: number) => String(value).padStart(2, "0");

    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
      now.getUTCDate()
    )}-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(
      now.getUTCSeconds()
    )}`;
  }

  private getLogsDir(): string {
    return path.resolve(process.cwd(), "logs");
  }

  private getArchivesDir(): string {
    return path.join(this.getLogsDir(), "archives");
  }
}
