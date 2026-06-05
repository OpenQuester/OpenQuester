import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { DAY_MS } from "domain/constants/time";
import { Environment } from "shared/config/Environment";
import { ILogger } from "shared/logging/ILogger";
import { type LogArchiveStore } from "shared/logging/LogArchiveStore";
import { LogPrefix } from "shared/logging/LogPrefix";

interface LogArchivalConfig {
  enabled: boolean;
  intervalDays: number;
  retentionDays: number;
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

  constructor(
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    @inject(DI_TOKENS.LogArchiveStore) private readonly logArchiveStore: LogArchiveStore
  ) {
    this.env = Environment.getInstance(this.logger);
  }

  public async checkAndArchive(): Promise<void> {
    const config = this.getConfig();

    if (!config.enabled) {
      this.logger.warn("Log archival is disabled", {
        prefix: this.logPrefix
      });
      return;
    }

    await this.logArchiveStore.ensureArchivesDir();

    const lastArchiveDate = await this.logArchiveStore.getLastArchiveDate();
    const shouldArchive = this.shouldArchive(lastArchiveDate, config);

    if (!shouldArchive) {
      const daysSinceLast = lastArchiveDate ? this.daysSince(lastArchiveDate) : null;

      this.logger.info("Log archival skipped", {
        prefix: this.logPrefix,
        daysSinceLastArchive: daysSinceLast,
        intervalDays: config.intervalDays,
        lastArchiveDate: lastArchiveDate?.toISOString()
      });
      return;
    }

    this.logger.info("Log archival triggered", {
      prefix: this.logPrefix,
      lastArchiveDate: lastArchiveDate?.toISOString(),
      intervalDays: config.intervalDays
    });

    const result = await this.archiveCurrentLogs();

    if (result) {
      this.logger.info("Log archive created", {
        prefix: this.logPrefix,
        archivePath: result.archivePath,
        archivedFiles: result.archivedFiles,
        totalBytes: result.totalBytes
      });
    }

    await this.cleanupOldArchives(config.retentionDays);
  }

  private getConfig(): LogArchivalConfig {
    return {
      enabled: this.env.LOG_ARCHIVE_ENABLED,
      intervalDays: this.env.LOG_ARCHIVE_INTERVAL_DAYS,
      retentionDays: this.env.LOG_ARCHIVE_RETENTION_DAYS
    };
  }

  private shouldArchive(lastArchiveDate: Date | null, config: LogArchivalConfig): boolean {
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

  private async archiveCurrentLogs() {
    try {
      const result = await this.logArchiveStore.archiveCurrentLogs();

      if (!result) {
        this.logger.info("No log files found to archive", {
          prefix: this.logPrefix
        });
        return null;
      }

      return result;
    } catch (error) {
      this.logger.error("Log archival failed", {
        prefix: this.logPrefix,
        error: error instanceof Error ? error.message : String(error)
      });

      return null;
    }
  }

  private async cleanupOldArchives(retentionDays: number): Promise<void> {
    const cutoff = Date.now() - retentionDays * DAY_MS;
    const removed = await this.logArchiveStore.cleanupArchivesOlderThan(cutoff);

    if (removed > 0) {
      this.logger.info("Old log archives deleted", {
        prefix: this.logPrefix,
        removed,
        retentionDays
      });
    }
  }
}
