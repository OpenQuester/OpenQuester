import { BaseCronJob } from "application/jobs/BaseCronJob";
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const BATCH = 50;
/** Older unfinished uploads are only checked when someone opens or plays them. */
const RECENT_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Clients that don't ask for the upload state after uploading (the Flutter
 * app) still see their packages turn ready: recent uploading packages are
 * checked against storage every few minutes.
 */
export class PackageUploadCheckJob extends BaseCronJob {
  public readonly name = "package-upload-check-job";
  public readonly enabled = true;

  constructor(
    logger: ILogger,
    private readonly packageRepository: PackageRepository,
    private readonly packageUploadService: PackageUploadService,
    public readonly cronExpression: string
  ) {
    super(logger);
  }

  protected async run(): Promise<void> {
    const ids = await this.packageRepository.getUploadingSince(
      new Date(Date.now() - RECENT_MS),
      BATCH
    );
    let ready = 0;
    for (const id of ids) {
      try {
        if ((await this.packageUploadService.refresh(id)).missingFilenames.length === 0) {
          ready++;
        }
      } catch (error) {
        this.logger.warn("Package upload check failed", {
          prefix: LogPrefix.CRON,
          packageId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (ids.length > 0) {
      this.logger.info("Checked unfinished package uploads", {
        prefix: LogPrefix.CRON,
        checked: ids.length,
        ready
      });
    }
  }
}
