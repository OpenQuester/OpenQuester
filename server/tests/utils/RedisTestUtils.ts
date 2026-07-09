import { Redis } from "ioredis";

import { RedisConfig } from "shared/config/RedisConfig";

const MAX_CLEANUP_ATTEMPTS = 10;
const MAX_DIAGNOSTIC_KEYS = 20;
const SAFE_REDIS_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export interface RedisCleanupClient {
  readonly options: {
    readonly host?: unknown;
    readonly port?: unknown;
    readonly db?: unknown;
  };
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<unknown>;
}

export interface RedisCleanupTarget {
  readonly host: string;
  readonly port: number;
  readonly db: number;
}

type RedisCleanupEnvironment = {
  readonly ENV?: string;
  readonly NODE_ENV?: string;
};

/**
 * Reads the target from the connected Redis client's resolved options rather
 * than environment strings that could differ from the client connection.
 */
export function resolveRedisCleanupTarget(
  client: Pick<RedisCleanupClient, "options">
): RedisCleanupTarget {
  return {
    host: String(client.options.host ?? "unknown"),
    port: parseInteger(client.options.port),
    db: parseInteger(client.options.db)
  };
}

/** Throws before a destructive Redis command can target an unsafe database. */
export function assertSafeRedisCleanupTarget(
  target: RedisCleanupTarget,
  env: RedisCleanupEnvironment = process.env as RedisCleanupEnvironment
): void {
  const failures: string[] = [];

  if (env.ENV !== "test") {
    failures.push(`ENV must equal "test" (received ${formatEnvValue(env.ENV)})`);
  }
  if (env.NODE_ENV !== "test") {
    failures.push(`NODE_ENV must equal "test" (received ${formatEnvValue(env.NODE_ENV)})`);
  }
  if (!SAFE_REDIS_HOSTS.has(target.host)) {
    failures.push(`host must be loopback (received ${target.host})`);
  }
  if (!Number.isInteger(target.db) || target.db < 1 || target.db > 14) {
    failures.push(`database must be an integer in 1..14 (received ${target.db})`);
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsafe Redis test cleanup target ${formatTarget(target)}: ${failures.join("; ")}`
    );
  }
}

/**
 * Clears a test Redis database without FLUSHDB so it also works with the
 * Compose service that deliberately disables Redis flush commands.
 */
export async function clearRedisKeys(
  client: RedisCleanupClient,
  env: RedisCleanupEnvironment = process.env as RedisCleanupEnvironment
): Promise<void> {
  const target = resolveRedisCleanupTarget(client);
  assertSafeRedisCleanupTarget(target, env);

  for (let attempts = 0; attempts < MAX_CLEANUP_ATTEMPTS; attempts += 1) {
    const keys = await client.keys("*");

    if (keys.length === 0) {
      return;
    }

    await client.del(...keys);
  }

  const remainingKeys = await client.keys("*");
  if (remainingKeys.length === 0) {
    return;
  }

  throw new Error(
    `Redis test cleanup left ${remainingKeys.length} keys after ${MAX_CLEANUP_ATTEMPTS} attempts ` +
      `at ${formatTarget(target)}: ${JSON.stringify(remainingKeys.slice(0, MAX_DIAGNOSTIC_KEYS))}`
  );
}

/**
 * Centralized Redis cleanup utilities for tests.
 *
 * Keeps the legacy facade so existing test setup can use the safe cleanup
 * target validation without a broad call-site migration.
 */
export class RedisTestUtils {
  private static redisClient: Redis;

  private static getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = RedisConfig.getClient();
    }

    if (this.redisClient.status !== "ready" && this.redisClient.status !== "connecting") {
      this.redisClient = RedisConfig.getClient();
    }

    return this.redisClient;
  }

  public static async clearAllKeys(): Promise<void> {
    await clearRedisKeys(this.getClient());
  }
}

function parseInteger(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return Number.NaN;
}

function formatTarget(target: RedisCleanupTarget): string {
  return `host=${target.host} port=${target.port} db=${target.db}`;
}

function formatEnvValue(value: string | undefined): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}
