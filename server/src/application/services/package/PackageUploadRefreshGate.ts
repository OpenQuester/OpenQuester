import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { RedisService } from "application/services/redis/RedisService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

export const UPLOAD_CHECK_RETRY_SECONDS = 2;
const LEASE_MS = 30_000;
const REDIS_COMMAND_TIMEOUT_MS = 1000;
const KEY_PREFIX = "{package-upload-check}";

const ACQUIRE = `
  if redis.call("EXISTS", KEYS[1], KEYS[2]) > 0 then
    return 0
  end
  for slot = 3, #KEYS do
    if redis.call("SET", KEYS[slot], ARGV[1], "PX", ARGV[2], "NX") then
      redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
      return KEYS[slot]
    end
  end
  return -1
`;

// A late release must leave a replacement lease and its cooldown untouched.
const RELEASE = `
  if redis.call("GET", KEYS[1]) == ARGV[1] and redis.call("GET", KEYS[3]) == ARGV[1] then
    if tonumber(ARGV[2]) > 0 then
      redis.call("SET", KEYS[2], "1", "EX", ARGV[2])
    end
    redis.call("DEL", KEYS[1], KEYS[3])
  end
`;

/** Admission is shared by the upload endpoint and cron across API replicas. */
@singleton()
export class PackageUploadRefreshGate {
  constructor(
    private readonly redis: RedisService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {}

  public async acquire(
    packageId: number,
    startedAt: number | null
  ): Promise<(cooldown: boolean) => Promise<void>> {
    const packageKey = `${KEY_PREFIX}:package:${packageId}`;
    const cooldownKey = `${KEY_PREFIX}:cooldown:${packageId}:${startedAt}`;
    const slotKeys = [`${KEY_PREFIX}:slot:1`, `${KEY_PREFIX}:slot:2`];
    const token = randomUUID();
    let slot: unknown;
    try {
      slot = await this.evaluate(ACQUIRE, [packageKey, cooldownKey, ...slotKeys], token, LEASE_MS);
    } catch (error) {
      this.logFailure("Could not acquire the package upload check lease", packageId, error);
    }
    if (slot === 0) {
      throw new ClientError(ClientResponse.PACKAGE_UPLOAD_CHECK_BUSY, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (typeof slot !== "string" || !slotKeys.includes(slot)) {
      throw new ClientError(
        ClientResponse.PACKAGE_UPLOAD_CHECK_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return async (cooldown: boolean): Promise<void> => {
      try {
        await this.evaluate(
          RELEASE,
          [packageKey, cooldownKey, slot],
          token,
          cooldown ? UPLOAD_CHECK_RETRY_SECONDS : 0
        );
      } catch (error) {
        this.logFailure("Could not release the package upload check lease", packageId, error);
      }
    };
  }

  private async evaluate(
    script: string,
    keys: string[],
    ...args: (string | number)[]
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Redis upload check command timed out")),
        REDIS_COMMAND_TIMEOUT_MS
      );
    });
    try {
      return await Promise.race([this.redis.eval(script, keys.length, ...keys, ...args), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  private logFailure(message: string, packageId: number, error: unknown): void {
    this.logger.warn(message, {
      prefix: LogPrefix.REDIS,
      packageId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
