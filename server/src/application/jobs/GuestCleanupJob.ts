import { BaseCronJob } from "application/jobs/BaseCronJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { DAY_MS } from "domain/constants/time";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const BATCH_SIZE = 500;

/**
 * Guests have no way back in once their session is gone, so a guest unseen
 * for `inactiveDays` is removed and their avatar deleted. A guest who
 * appears in game statistics is only marked deleted, keeping that history
 * (games, players, scores and chronology stay intact).
 */
export class GuestCleanupJob extends BaseCronJob {
  public readonly name = "guest-cleanup-job";
  public readonly enabled: boolean;

  constructor(
    logger: ILogger,
    private readonly storageCleanupService: StorageCleanupService,
    private readonly inactiveDays: number,
    public readonly cronExpression: string
  ) {
    super(logger);
    this.enabled = inactiveDays > 0;
  }

  protected async run(): Promise<void> {
    const inactiveDaysMs = this.inactiveDays * DAY_MS;
    const before = new Date(Date.now() - inactiveDaysMs);

    let deleted = 0;
    let markedDeleted = 0;
    let batchFull = true;

    // Each batch removes the guests it found, so the next one starts fresh
    while (batchFull) {
      const batch = await this.storageCleanupService.removeInactiveGuests(before, BATCH_SIZE);

      deleted += batch.deleted;
      markedDeleted += batch.markedDeleted;
      batchFull = batch.found === BATCH_SIZE;
    }

    this.logger.info("Inactive guests cleaned up", {
      prefix: LogPrefix.CRON,
      deleted,
      markedDeleted,
      inactiveDays: this.inactiveDays
    });
  }
}
