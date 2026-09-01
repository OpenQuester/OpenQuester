import { afterEach, describe, expect, it } from "@jest/globals";

import { clearRedisKeys, type RedisCleanupClient } from "tests/utils/RedisTestUtils";
import { assertSafeTestPostgresTarget } from "tests/TestEnvironment";
import { getTestDbName, getTestRedisDb, TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import {
  createTestAppDataSource,
  resolveTestPostgresSettings,
  resolveTestRedisSettings,
  setTestEnvDefaults
} from "tests/utils/utils";

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

describe("test environment PostgreSQL safety", () => {
  it("resolves loopback PostgreSQL defaults and the generated worker database", () => {
    expect(resolveTestPostgresSettings({})).toEqual({
      host: "127.0.0.1",
      port: "5432",
      user: "postgres",
      password: "postgres",
      database: getTestDbName()
    });
  });

  it("uses every explicit TEST_DB connection override", () => {
    expect(
      resolveTestPostgresSettings({
        TEST_DB_HOST: "localhost",
        TEST_DB_PORT: "5433",
        TEST_DB_USER: "test-user",
        TEST_DB_PASS: "test-password"
      })
    ).toEqual({
      host: "localhost",
      port: "5433",
      user: "test-user",
      password: "test-password",
      database: getTestDbName()
    });
  });

  it("bounds datasource connection and query lifecycle", () => {
    const dataSource = createTestAppDataSource();

    expect(dataSource.options).toMatchObject({
      extra: {
        connectionTimeoutMillis: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
        query_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
        statement_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS
      }
    });
  });

  it("cannot inherit ordinary runtime PostgreSQL settings or an arbitrary database name", () => {
    Object.assign(process.env, {
      DB_HOST: "production.example.test",
      DB_PORT: "9999",
      DB_USER: "production-user",
      DB_PASS: "production-password",
      DB_NAME: "production",
      TEST_DB_NAME: "arbitrary-test-database",
      TEST_DB_NAME_PREFIX: "production"
    });
    delete process.env.TEST_DB_HOST;
    delete process.env.TEST_DB_PORT;
    delete process.env.TEST_DB_USER;
    delete process.env.TEST_DB_PASS;

    setTestEnvDefaults();

    expect(process.env.DB_HOST).toBe("127.0.0.1");
    expect(process.env.DB_PORT).toBe("5432");
    expect(process.env.DB_USER).toBe("postgres");
    expect(process.env.DB_PASS).toBe("postgres");
    expect(process.env.DB_NAME).toBe(getTestDbName());
  });

  it.each([
    ["non-test ENV", { ENV: "development", NODE_ENV: "test" }],
    ["non-test NODE_ENV", { ENV: "test", NODE_ENV: "development" }]
  ])("rejects %s", (_label, environment) => {
    expect(() =>
      assertSafeTestPostgresTarget({ host: "127.0.0.1", database: getTestDbName() }, environment)
    ).toThrow("Unsafe PostgreSQL test target");
  });

  it("rejects non-loopback and non-generated database targets without exposing passwords", () => {
    const password = "top-secret-password";
    const target = {
      ...resolveTestPostgresSettings({
        TEST_DB_HOST: "postgres.example.test",
        TEST_DB_PASS: password
      }),
      database: "production"
    };

    const error = captureSynchronousFailure(() =>
      assertSafeTestPostgresTarget(target, safeEnvironment)
    );

    expect(error.message).toContain("host must be loopback");
    expect(error.message).toContain("database must equal the generated worker database");
    expect(error.message).not.toContain(password);
  });
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

  it("uses Redis' default ACL user for a password-only test target", () => {
    process.env.TEST_REDIS_USERNAME = "";
    process.env.TEST_REDIS_PASSWORD = "test-password";

    setTestEnvDefaults();

    expect(process.env.REDIS_USERNAME).toBe("default");
    expect(process.env.REDIS_PASSWORD).toBe("test-password");
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
    [
      "non-test ENV",
      { host: "127.0.0.1", port: 6380, db: 1 },
      { ENV: "development", NODE_ENV: "test" }
    ],
    [
      "non-test NODE_ENV",
      { host: "127.0.0.1", port: 6380, db: 1 },
      { ENV: "test", NODE_ENV: "development" }
    ]
  ])("rejects unsafe target: %s before inspecting keys", async (_label, options, environment) => {
    const client = new FakeRedisClient(options, ["key"]);

    await expect(clearRedisKeys(client, environment)).rejects.toThrow(
      "Unsafe Redis test cleanup target"
    );
    expect(client.keysCalls).toBe(0);
    expect(client.deletedKeyBatches).toHaveLength(0);
  });

  it("deletes keys until the test database is empty", async () => {
    const client = new FakeRedisClient({ host: "127.0.0.1", port: 6380, db: 1 }, [
      "first",
      "second"
    ]);

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

function captureSynchronousFailure(action: () => void): Error {
  try {
    action();
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
