import { Client } from "pg";
import { DataSource } from "typeorm";

import { RedisConfig } from "shared/config/RedisConfig";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { withTimeout } from "tests/e2e/harness/TestPromiseUtils";
import { RedisTestUtils } from "tests/utils/RedisTestUtils";
import {
  createTestAppDataSource,
  resolveTestPostgresSettings,
  type TestPostgresSettings
} from "tests/utils/utils";
import { getTestDbName, TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

type ClosableLogger = ILogger & {
  close?: () => Promise<void>;
};

interface TestEnvironmentFlags {
  readonly ENV?: string;
  readonly NODE_ENV?: string;
}

const SAFE_POSTGRES_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SAFE_TEST_DATABASE_PATTERN = /^test_db_[1-9]\d*$/;

export class TestEnvironment {
  private testDataSource!: DataSource;

  constructor(private readonly logger: ILogger) {
    //
  }

  public async setup(): Promise<void> {
    this.testDataSource = createTestAppDataSource();
    await this.createTestDatabase();
    await this.testDataSource.initialize();
    await this.testDataSource.runMigrations();

    // Init Redis configuration
    RedisConfig.getClient(); // Get client to initialize it
    await RedisConfig.initConfig();
    await RedisConfig.waitForConnection();
    await this.clearRedis();
  }

  public async teardown(): Promise<void> {
    this.logger.info("Tearing down test environment...", {
      prefix: LogPrefix.TEST
    });
    const failures: Error[] = [];

    await collectTeardownFailure(failures, "Test data source destroy", async () => {
      if (this.testDataSource?.isInitialized) {
        await withTimeout(
          this.testDataSource.destroy(),
          TEST_TIMEOUTS.RESOURCE_CLEANUP_TIMEOUT_MS,
          "test data source destroy"
        );
      }
    });
    await collectTeardownFailure(failures, "Test database drop", async () => {
      await this.dropTestDatabase();
    });
    await collectTeardownFailure(failures, "Test Redis disconnect", async () => {
      await withTimeout(
        RedisConfig.disconnect({ strict: true }),
        TEST_TIMEOUTS.RESOURCE_CLEANUP_TIMEOUT_MS,
        "test Redis disconnect"
      );
    });

    const closableLogger = this.logger as ClosableLogger;
    await collectTeardownFailure(failures, "Test logger close", async () => {
      if (closableLogger.close) {
        await withTimeout(
          closableLogger.close(),
          TEST_TIMEOUTS.RESOURCE_CLEANUP_TIMEOUT_MS,
          "test logger close"
        );
      }
    });

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Test environment teardown failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  public getDatabase() {
    return this.testDataSource;
  }

  /**
   * Clear all Redis keys with robust cleanup logic
   * Should be called in beforeEach to ensure clean state
   */
  public async clearRedis(): Promise<void> {
    await RedisTestUtils.clearAllKeys();
  }

  private async createTestDatabase(): Promise<void> {
    await this._withPGClient(async (client, dbName) => {
      await this._forceDropTestDatabase(client, dbName);
      await client.query(`CREATE DATABASE ${this._escapeIdentifier(dbName)};`);
    });
  }

  private async dropTestDatabase(): Promise<void> {
    await this._withPGClient(async (client, dbName) => {
      await this._forceDropTestDatabase(client, dbName);
    });
  }

  private async _withPGClient(
    operation: (client: Client, dbName: string) => Promise<void>
  ): Promise<void> {
    const settings = resolveTestPostgresSettings();
    assertSafeTestPostgresTarget(settings);
    const client = this._getPGClient(settings);
    const failures: unknown[] = [];

    try {
      await withTimeout(
        client.connect(),
        TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
        `PostgreSQL connect to safe test host ${settings.host}`
      );
      await withTimeout(
        operation(client, settings.database),
        TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
        `PostgreSQL operation on safe test database ${settings.database}`
      );
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await withTimeout(
          client.end(),
          TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
          "PostgreSQL test client close"
        );
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        `PostgreSQL operation and client close failed: ${failures
          .map((failure) => (failure instanceof Error ? failure.message : String(failure)))
          .join("; ")}`
      );
    }
  }

  private async _forceDropTestDatabase(client: Client, dbName: string): Promise<void> {
    await client.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid();
      `,
      [dbName]
    );

    await client.query(`DROP DATABASE IF EXISTS ${this._escapeIdentifier(dbName)};`);
  }

  private _getPGClient(settings: TestPostgresSettings) {
    return new Client({
      user: settings.user,
      password: settings.password,
      host: settings.host,
      port: Number.parseInt(settings.port, 10),
      database: "postgres",
      connectionTimeoutMillis: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
      query_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
      statement_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS
    });
  }

  private _escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

/** Throws before a PostgreSQL client can connect to an unsafe destructive target. */
export function assertSafeTestPostgresTarget(
  target: Pick<TestPostgresSettings, "host" | "database">,
  env: TestEnvironmentFlags = process.env as TestEnvironmentFlags
): void {
  const failures: string[] = [];

  if (env.ENV !== "test") {
    failures.push(`ENV must equal "test" (received ${formatEnvValue(env.ENV)})`);
  }
  if (env.NODE_ENV !== "test") {
    failures.push(`NODE_ENV must equal "test" (received ${formatEnvValue(env.NODE_ENV)})`);
  }
  if (!SAFE_POSTGRES_HOSTS.has(target.host)) {
    failures.push(`host must be loopback (received ${target.host})`);
  }
  if (target.database !== getTestDbName() || !SAFE_TEST_DATABASE_PATTERN.test(target.database)) {
    failures.push(
      `database must equal the generated worker database ${getTestDbName()} ` +
        `(received ${target.database})`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Unsafe PostgreSQL test target: ${failures.join("; ")}`);
  }
}

async function collectTeardownFailure(
  failures: Error[],
  label: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    failures.push(
      new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error
      })
    );
  }
}

function formatEnvValue(value: string | undefined): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}
