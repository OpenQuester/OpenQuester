import { afterEach, describe, expect, it } from "@jest/globals";

import {
  clearRedisKeys,
  type RedisCleanupClient
} from "tests/utils/RedisTestUtils";
import { getTestRedisDb } from "tests/utils/TestTimeouts";
import { resolveTestRedisSettings, setTestEnvDefaults } from "tests/utils/utils";

const originalEnvironment = { ...process.env };

class FakeRedisClient implements RedisCleanupClient {
  public keysCalls = 0;
  public readonly deletedKeyBatches: string[][] = [];

  public constructor(
    public readonly options: {
      readonly host?: unknown;
      readonly port?: unknown;
      readonly db?: unknown;
      readonly password?: string;
    },
    private readonly keysInDatabase: string[],
    private readonly preserveKeys = false
  ) {}

  public async keys(_pattern: string): Promise<string[]> {
    this.keysCalls += 1;
    return [...this.keysInDatabase];
  }

  public async del(...keys: string[]): Promise<unknown> {
    this.deletedKeyBatches.push(keys);

    if (!this.preserveKeys) {
      for (const key of keys) {
        const keyIndex = this.keysInDatabase.indexOf(key);
        if (keyIndex >= 0) {
          this.keysInDatabase.splice(keyIndex, 1);
        }
      }
    }

    return keys.length;
  }
}

const safeEnvironment = { ENV: "test", NODE_ENV: "test" };

afterEach(() => {
  restoreEnvironment();
});

describe("test environment Redis safety", () => {
  it("resolves local Compose Redis defaults and the worker database", () => {
    delete process.env.TEST_REDIS_HOST;
    delete process.env.TEST_REDIS_PORT;
    delete process.env.TEST_REDIS_USERNAME;
    delete process.env.TEST_REDIS_PASSWORD;
    delete process.env.TEST_REDIS_DB_NUMBER;

    expect(resolveTestRedisSettings()).toEqual({
      host: "127.0.0.1",
      port: "6380",
      username: "",
      password: "",
      dbNumber: String(getTestRedisDb())
    });
  });

  it("uses every explicit TEST_REDIS override", () => {
    expect(
      resolveTestRedisSettings({
        TEST_REDIS_HOST: "localhost",
        TEST_REDIS_PORT: "6381",
        TEST_REDIS_USERNAME: "test-user",
        TEST_REDIS_PASSWORD: "test-password",
        TEST_REDIS_DB_NUMBER: "13"
      })
    ).toEqual({
      host: "localhost",
      port: "6381",
      username: "test-user",
      password: "test-password",
      dbNumber: "13"
    });
  });

  it("cannot inherit ordinary runtime Redis settings", () => {
    Object.assign(process.env, {
      REDIS_HOST: "unsafe.example.test",
      REDIS_PORT: "9999",
      REDIS_USERNAME: "unsafe-user",
      REDIS_PASSWORD: "unsafe-password",
      REDIS_DB_NUMBER: "0"
    });
    delete process.env.TEST_REDIS_HOST;
    delete process.env.TEST_REDIS_PORT;
    delete process.env.TEST_REDIS_USERNAME;
    delete process.env.TEST_REDIS_PASSWORD;
    delete process.env.TEST_REDIS_DB_NUMBER;

    setTestEnvDefaults();

    expect(process.env.REDIS_HOST).toBe("127.0.0.1");
    expect(process.env.REDIS_PORT).toBe("6380");
    expect(process.env.REDIS_USERNAME).toBe("");
    expect(process.env.REDIS_PASSWORD).toBe("");
    expect(process.env.REDIS_DB_NUMBER).toBe(String(getTestRedisDb()));
  });

  it.each([
    ["database zero", { host: "127.0.0.1", port: 6380, db: 0 }, safeEnvironment],
    ["non-loopback host", { host: "redis.example.test", port: 6380, db: 1 }, safeEnvironment],
    ["non-test ENV", { host: "127.0.0.1", port: 6380, db: 1 }, { ENV: "development", NODE_ENV: "test" }],
    ["non-test NODE_ENV", { host: "127.0.0.1", port: 6380, db: 1 }, { ENV: "test", NODE_ENV: "development" }]
  ])("rejects unsafe target: %s before inspecting keys", async (_label, options, environment) => {
    const client = new FakeRedisClient(options, ["key"]);

    await expect(clearRedisKeys(client, environment)).rejects.toThrow("Unsafe Redis test cleanup target");
    expect(client.keysCalls).toBe(0);
    expect(client.deletedKeyBatches).toHaveLength(0);
  });

  it("deletes keys until the test database is empty", async () => {
    const client = new FakeRedisClient(
      { host: "127.0.0.1", port: 6380, db: 1 },
      ["first", "second"]
    );

    await clearRedisKeys(client, safeEnvironment);

    expect(client.deletedKeyBatches).toEqual([["first", "second"]]);
    expect(client.keysCalls).toBe(2);
  });

  it("fails closed when concurrent writers leave residual keys without exposing credentials", async () => {
    const client = new FakeRedisClient(
      { host: "127.0.0.1", port: 6380, db: 1, password: "top-secret-password" },
      Array.from({ length: 25 }, (_, index) => `key-${index}`),
      true
    );

    const error = await captureFailure(() => clearRedisKeys(client, safeEnvironment));

    expect(error.message).toContain("25 keys after 10 attempts");
    expect(error.message).toContain("host=127.0.0.1 port=6380 db=1");
    expect(error.message).toContain("key-19");
    expect(error.message).not.toContain("key-20");
    expect(error.message).not.toContain("top-secret-password");
    expect(client.deletedKeyBatches).toHaveLength(10);
    expect(client.keysCalls).toBe(11);
  });
});

async function captureFailure(action: () => Promise<void>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error("Expected action to fail");
}

function restoreEnvironment(): void {
  const originalKeys = new Set(Object.keys(originalEnvironment));

  for (const key of Object.keys(process.env)) {
    if (!originalKeys.has(key)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnvironment)) {
    process.env[key] = value;
  }
}
