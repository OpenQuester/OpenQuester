import { BaseCronJob } from "application/jobs/BaseCronJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const BATCH = 500;

/**
 * Guests have no way back in once their session is gone, so a guest unseen
 * for `inactiveDays` is removed and their avatar deleted. A guest who
 * appears in game statistics is only marked deleted, keeping that history.
 */
export class GuestCleanupJob extends BaseCronJob {
  public readonly name = "guest-cleanup-job";
  public readonly enabled: boolean;

  constructor(
    logger: ILogger,
    private readonly storageRepository: StorageRepository,
    private readonly storageCleanupService: StorageCleanupService,
    private readonly inactiveDays: number,
    public readonly cronExpression: string
  ) {
    super(logger);
    this.enabled = inactiveDays > 0;
  }

  protected async run(): Promise<void> {
    const before = new Date(Date.now() - this.inactiveDays * 24 * 60 * 60 * 1000);
    let removed = 0;
    let kept = 0;
    for (;;) {
      const guests = await this.storageRepository.getInactiveGuests(before, BATCH);
      if (guests.length === 0) break;
      const avatars: string[] = [];
      for (const guest of guests) {
        await this.storageRepository.removeGuest(guest.id, guest.hasGames);
        if (guest.avatarFilename) avatars.push(guest.avatarFilename);
        if (guest.hasGames) kept++;
        else removed++;
      }
      await this.storageCleanupService.removeIfUnused(avatars);
      if (guests.length < BATCH) break;
    }
    this.logger.info("Inactive guests cleaned up", {
      prefix: LogPrefix.CRON,
      deleted: removed,
      markedDeleted: kept,
      inactiveDays: this.inactiveDays
    });
  }
}
