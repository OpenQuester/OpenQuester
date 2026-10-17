import { BaseCronJob } from "application/jobs/BaseCronJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { DAY_MS } from "domain/constants/time";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const BATCH_SIZE = 500;

/**
 * Guests have no way back in once their session is gone, so a guest unseen
 * for `inactiveDays` is removed and their avatar deleted. A guest who
 * appears in game statistics or owns a package is only marked deleted,
 * keeping their history and package attribution.
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

    let removed = 0;
    let kept = 0;
    let hasMoreGuests = true;

    while (hasMoreGuests) {
      const batch = await this.storageCleanupService.removeInactiveGuests(before, BATCH_SIZE);
      removed += batch.deletedCount;
      kept += batch.retainedCount;
      hasMoreGuests = batch.deletedCount + batch.retainedCount === BATCH_SIZE;
    }

    this.logger.info("Inactive guests cleaned up", {
      prefix: LogPrefix.CRON,
      deleted: removed,
      markedDeleted: kept,
      inactiveDays: this.inactiveDays
    });
  }
}
