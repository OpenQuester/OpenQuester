import archiver from "archiver";
import fs from "fs";
import path from "path";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import {
  type LogArchiveResult,
  type LogArchiveStore
} from "shared/logging/LogArchiveStore";
import { LogPrefix } from "shared/logging/LogPrefix";

const ARCHIVE_FILENAME_REGEX = /^logs-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.tar\.gz$/;

@singleton()
export class FileSystemLogArchiveStore implements LogArchiveStore {
  private readonly logPrefix = LogPrefix.LOG_ARCHIVAL;

  constructor(@inject(DI_TOKENS.Logger) private readonly logger: ILogger) {
    //
  }

  public async ensureArchivesDir(): Promise<void> {
    await fs.promises.mkdir(this.getArchivesDir(), { recursive: true });
  }

  public async getLastArchiveDate(): Promise<Date | null> {
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

  public async archiveCurrentLogs(): Promise<LogArchiveResult | null> {
    const logFiles = await this.listLogFiles();

    if (logFiles.length === 0) {
      return null;
    }

    const timestamp = this.buildTimestamp();
    const tempDir = path.join(this.getArchivesDir(), `temp-${timestamp}`);
    const archiveName = `logs-${timestamp}.tar.gz`;
    const archivePath = path.join(this.getArchivesDir(), archiveName);

    await fs.promises.mkdir(tempDir, { recursive: true });

    let totalBytes = 0;

    try {
      for (const filePath of logFiles) {
        const fileName = path.basename(filePath);
        const destPath = path.join(tempDir, fileName);
        await fs.promises.copyFile(filePath, destPath);

        const stats = await fs.promises.stat(filePath);
        totalBytes += stats.size;
      }

      await this.createArchiveFromDir(tempDir, archivePath);
      await this.truncateLogFiles(logFiles);

      return {
        archivePath,
        archivedFiles: logFiles.length,
        totalBytes
      };
    } catch (error) {
      await this.removePartialArchive(archivePath);
      throw error;
    } finally {
      await this.removeTempDir(tempDir);
    }
  }

  public async cleanupArchivesOlderThan(cutoffTimestamp: number): Promise<number> {
    const archiveFiles = await this.listArchiveFiles();
    let removed = 0;

    for (const file of archiveFiles) {
      const archiveDate = this.parseArchiveDate(file);
      if (!archiveDate) continue;

      if (archiveDate.getTime() < cutoffTimestamp) {
        const filePath = path.join(this.getArchivesDir(), file);
        try {
          await fs.promises.unlink(filePath);
          removed++;
        } catch (error) {
          this.logger.warn("Failed to delete old archive", {
            prefix: this.logPrefix,
            filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return removed;
  }

  private async createArchiveFromDir(sourceDir: string, archivePath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver("tar", {
        gzip: true,
        gzipOptions: { level: 9 }
      });

      output.on("close", () => resolve());
      output.on("error", (error) => reject(error));
      archive.on("warning", (warning) => {
        this.logger.warn("Log archival warning", {
          prefix: this.logPrefix,
          warning: warning.message
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
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.info("Log files truncated after archive", {
      prefix: this.logPrefix,
      truncated,
      total: logFiles.length
    });
  }

  private async listArchiveFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.getArchivesDir(), {
        withFileTypes: true
      });

      return entries
        .filter((entry) => entry.isFile() && ARCHIVE_FILENAME_REGEX.test(entry.name))
        .map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      this.logger.warn("Failed to list log archives", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private async listLogFiles(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.getLogsDir(), {
        withFileTypes: true
      });

      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
        .map((entry) => path.join(this.getLogsDir(), entry.name));
    } catch (error) {
      this.logger.warn("Failed to list log files", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private async removePartialArchive(archivePath: string): Promise<void> {
    try {
      await fs.promises.rm(archivePath, { force: true });
    } catch (error) {
      this.logger.warn("Failed to remove partial log archive file", {
        prefix: this.logPrefix,
        archivePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async removeTempDir(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn("Failed to remove archival temp directory", {
        prefix: this.logPrefix,
        tempDir,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private parseArchiveDate(filename: string): Date | null {
    const match = ARCHIVE_FILENAME_REGEX.exec(filename);
    if (!match) return null;
    if (match.length !== 7) return null;

    const [year, month, day, hour, minute, second] = match.slice(1).map((value) => Number(value));
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private buildTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
      now.getUTCDate()
    )}-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}`;
  }

  private getLogsDir(): string {
    return path.resolve(process.cwd(), "logs");
  }

  private getArchivesDir(): string {
    return path.join(this.getLogsDir(), "archives");
  }
}
