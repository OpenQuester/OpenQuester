import { BaseCronJob } from "application/jobs/BaseCronJob";
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { RedisService } from "application/services/redis/RedisService";
import { ClientError } from "domain/errors/ClientError";
import { HttpStatus } from "domain/enums/HttpStatus";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const BATCH = 50;
/** Older uploads can still be checked by the author or an editor. */
const RECENT_MS = 2 * 24 * 60 * 60 * 1000;
const RUN_BUDGET_MS = 4 * 60 * 1000;
const CURSOR_KEY = "package-upload-check:cursor";

/**
 * Clients that skip the upload status check still see their packages turn ready.
 * The job checks recent uploads against storage every few minutes.
 */
export class PackageUploadCheckJob extends BaseCronJob {
  public readonly name = "package-upload-check-job";
  public readonly enabled = true;
  public readonly lockTtlSeconds = 290;

  constructor(
    logger: ILogger,
    private readonly packageUploadService: PackageUploadService,
    private readonly redis: RedisService,
    public readonly cronExpression: string
  ) {
    super(logger);
  }

  protected async run(): Promise<void> {
    const deadline = performance.now() + RUN_BUDGET_MS;
    const since = new Date(Date.now() - RECENT_MS);
    const cursor = Number(await this.redis.get(CURSOR_KEY)) || 0;
    let ids = await this.packageUploadService.getUploadingSince(since, BATCH, cursor);
    if (ids.length === 0 && cursor > 0) {
      ids = await this.packageUploadService.getUploadingSince(since, BATCH, 0);
    }

    let lastId = 0;
    let checked = 0;
    let ready = 0;
    let deferred = 0;
    for (const id of ids) {
      if (performance.now() >= deadline) {
        break;
      }
      lastId = id;
      checked++;
      try {
        if ((await this.packageUploadService.refresh(id)).status === PackageUploadStatus.READY) {
          ready++;
        }
      } catch (error) {
        if (
          error instanceof ClientError &&
          (error.code === HttpStatus.TOO_MANY_REQUESTS || error.code === HttpStatus.SERVICE_UNAVAILABLE)
        ) {
          deferred++;
          continue;
        }
        this.logger.warn("Package upload check failed", {
          prefix: LogPrefix.CRON,
          packageId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (checked > 0) {
      await this.redis.set(CURSOR_KEY, String(lastId), RECENT_MS);
      this.logger.info("Checked unfinished package uploads", {
        prefix: LogPrefix.CRON,
        checked,
        ready,
        deferred
      });
    }
  }
}
