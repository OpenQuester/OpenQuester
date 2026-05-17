export interface LogArchiveResult {
  archivePath: string;
  archivedFiles: number;
  totalBytes: number;
}

export interface LogArchiveStore {
  ensureArchivesDir(): Promise<void>;
  getLastArchiveDate(): Promise<Date | null>;
  archiveCurrentLogs(): Promise<LogArchiveResult | null>;
  cleanupArchivesOlderThan(cutoffTimestamp: number): Promise<number>;
}
