import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type Client } from "pg";
import { type DataSource } from "typeorm";

import { type ILogger } from "shared/logging/ILogger";
import { RedisConfig } from "shared/config/RedisConfig";
import { TestEnvironment } from "tests/TestEnvironment";
import { getTestDbName, TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { setTestEnvDefaults } from "tests/utils/utils";

const originalEnvironment = { ...process.env };
let redisDisconnect: jest.SpiedFunction<typeof RedisConfig.disconnect>;

beforeEach(() => {
  setTestEnvDefaults();
  redisDisconnect = jest.spyOn(RedisConfig, "disconnect").mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restoreEnvironment();
});

describe("TestEnvironment teardown", () => {
  it("connects and drops only the safe generated worker database", async () => {
    const client = createClient({});
    const close = jest.fn<() => Promise<void>>().mockResolvedValue();
    const environment = createEnvironment(
      { close },
      { isInitialized: false, destroy: jest.fn<() => Promise<void>>() },
      client
    );

    await environment.teardown();

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT pg_terminate_backend"),
      [getTestDbName()]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      `DROP DATABASE IF EXISTS "${getTestDbName()}";`
    );
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledWith({ strict: true });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsafe target before connecting or querying and keeps diagnostics secret-free", async () => {
    const password = "top-secret-password";
    process.env.TEST_DB_HOST = "postgres.example.test";
    process.env.TEST_DB_PASS = password;
    const client = createClient({});
    const close = jest.fn<() => Promise<void>>().mockResolvedValue();
    const environment = createEnvironment(
      { close },
      { isInitialized: false, destroy: jest.fn<() => Promise<void>>() },
      client
    );

    const error = await captureFailure(() => environment.teardown());

    expect(error.message).toContain("Unsafe PostgreSQL test target");
    expect(error.message).not.toContain(password);
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
    expect(client.end).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("attempts every teardown step and aggregates independent failures", async () => {
    const dataSourceFailure = new Error("data source remained open");
    const databaseFailure = new Error("postgres unavailable");
    const loggerFailure = new Error("logger flush failed");
    const redisFailure = new Error("Redis client remained open");
    const destroy = jest.fn<() => Promise<void>>().mockRejectedValue(dataSourceFailure);
    const client = createClient({ connectFailure: databaseFailure });
    const close = jest.fn<() => Promise<void>>().mockRejectedValue(loggerFailure);
    redisDisconnect.mockRejectedValue(redisFailure);
    const environment = createEnvironment({ close }, { isInitialized: true, destroy }, client);

    const error = await captureFailure(() => environment.teardown());

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([
      expect.objectContaining({
        message: "Test data source destroy failed: data source remained open"
      }),
      expect.objectContaining({ message: "Test database drop failed: postgres unavailable" }),
      expect.objectContaining({
        message: "Test Redis disconnect failed: Redis client remained open"
      }),
      expect.objectContaining({ message: "Test logger close failed: logger flush failed" })
    ]);
  });

  it("retains both a PostgreSQL operation failure and client close failure", async () => {
    const queryFailure = new Error("drop query failed");
    const closeFailure = new Error("client close failed");
    const client = createClient({ queryFailure, closeFailure });
    const loggerClose = jest.fn<() => Promise<void>>().mockResolvedValue();
    const environment = createEnvironment(
      { close: loggerClose },
      { isInitialized: false, destroy: jest.fn<() => Promise<void>>() },
      client
    );

    const error = await captureFailure(() => environment.teardown());
    const databaseFailure = (error as AggregateError).errors[0] as Error;
    const postgresFailure = databaseFailure.cause as AggregateError;

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(postgresFailure).toBeInstanceOf(AggregateError);
    expect(postgresFailure.errors).toEqual([queryFailure, closeFailure]);
  });

  it("bounds a PostgreSQL operation that never settles and still attempts client close", async () => {
    jest.useFakeTimers();
    const client = createClient({ hangingQuery: true });
    const loggerClose = jest.fn<() => Promise<void>>().mockResolvedValue();
    const environment = createEnvironment(
      { close: loggerClose },
      { isInitialized: false, destroy: jest.fn<() => Promise<void>>() },
      client
    );

    const teardown = environment.teardown();
    const failure = captureFailure(() => teardown);
    await jest.advanceTimersByTimeAsync(TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS);
    const error = await failure;

    expect(error.message).toContain("PostgreSQL operation on safe test database");
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
  });
});

interface FakeClient {
  readonly connect: jest.Mock<() => Promise<void>>;
  readonly query: jest.Mock<() => Promise<unknown>>;
  readonly end: jest.Mock<() => Promise<void>>;
}

function createClient(options: {
  connectFailure?: Error;
  queryFailure?: Error;
  closeFailure?: Error;
  hangingQuery?: boolean;
}): FakeClient {
  const connect = options.connectFailure
    ? jest.fn<() => Promise<void>>().mockRejectedValue(options.connectFailure)
    : jest.fn<() => Promise<void>>().mockResolvedValue();
  const query = options.hangingQuery
    ? jest.fn<() => Promise<unknown>>(() => new Promise(() => undefined))
    : options.queryFailure
      ? jest.fn<() => Promise<unknown>>().mockRejectedValue(options.queryFailure)
      : jest.fn<() => Promise<unknown>>().mockResolvedValue({});
  const end = options.closeFailure
    ? jest.fn<() => Promise<void>>().mockRejectedValue(options.closeFailure)
    : jest.fn<() => Promise<void>>().mockResolvedValue();

  return { connect, query, end };
}

function createEnvironment(
  logger: { close: () => Promise<void> },
  dataSource: Pick<DataSource, "isInitialized" | "destroy">,
  client: FakeClient
): TestEnvironment {
  const testLogger = {
    info: jest.fn(),
    close: logger.close
  } as unknown as ILogger;
  const environment = new TestEnvironment(testLogger);
  const internals = environment as unknown as {
    testDataSource: Pick<DataSource, "isInitialized" | "destroy">;
    _getPGClient: () => Client;
  };
  internals.testDataSource = dataSource;
  internals._getPGClient = () => client as unknown as Client;
  return environment;
}

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
